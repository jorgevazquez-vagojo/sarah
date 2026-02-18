const { logger } = require('../utils/logger');
const { db } = require('../utils/db');
const { redis } = require('../utils/redis');
const { verifyToken } = require('../middleware/auth');
const { transition } = require('../state/conversation-fsm');
const { triggerWebhooks } = require('../integrations/webhooks');
const { dispatchToCRM } = require('../integrations/crm');

// Map of agentId -> ws
const agents = new Map();

function send(ws, type, data) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type, ...data }));
  }
}

function initAgentHandler(wss) {
  wss.on('connection', (ws, req) => {
    const token = new URL(req.url, 'http://localhost').searchParams.get('token');
    let agent;
    try {
      agent = verifyToken(token);
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    agents.set(agent.id, ws);
    logger.info(`Agent WS connected: ${agent.username} (${agent.id})`);

    // Send initial queue
    db.getWaitingConversations().then((convs) => {
      send(ws, 'queue', { conversations: convs });
    }).catch((e) => logger.warn('Failed to load queue:', e.message));

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw);
        await handleAgentMessage(ws, agent, msg);
      } catch (e) {
        logger.error(`Agent WS error (${agent.username}):`, e);
      }
    });

    ws.on('close', () => {
      agents.delete(agent.id);
      db.updateAgentStatus(agent.id, 'offline').catch(() => {});
      logger.info(`Agent WS disconnected: ${agent.username}`);
    });
  });

  // Listen for visitor messages via Redis
  redis.subscribe('visitor:message', (data) => {
    // Find which agent owns this conversation
    db.getConversation(data.conversationId).then((conv) => {
      if (conv?.agent_id) {
        const ws = agents.get(conv.agent_id);
        if (ws) {
          send(ws, 'visitor_message', {
            conversationId: data.conversationId,
            content: data.content,
            timestamp: data.timestamp,
          });
        }
      }
    }).catch(() => {});
  }).catch((e) => logger.warn('Redis subscribe error:', e.message));

  // Listen for new queue entries
  redis.subscribe('queue:new', (data) => {
    // Broadcast to all matching agents
    for (const [agentId, ws] of agents) {
      send(ws, 'queue_new', data);
    }
  }).catch((e) => logger.warn('Redis subscribe error:', e.message));
}

async function handleAgentMessage(ws, agent, msg) {
  switch (msg.type) {
    case 'accept_conversation': {
      if (!msg.conversationId) {
        send(ws, 'error', { message: 'conversationId required' });
        return;
      }

      // Atomic claim: only succeeds if still waiting for agent (prevents race condition)
      const claimed = await db.query(
        `UPDATE conversations SET agent_id = $2, updated_at = NOW()
         WHERE id = $1 AND state = 'chat_waiting_agent' AND agent_id IS NULL
         RETURNING *`,
        [msg.conversationId, agent.id]
      );
      if (!claimed.rows[0]) {
        send(ws, 'error', { message: 'Conversation not available' });
        return;
      }
      const conv = claimed.rows[0];

      await transition(conv.id, 'agent_accept');
      await db.updateAgentStatus(agent.id, 'busy');

      // Save system message
      await db.saveMessage({
        conversationId: conv.id,
        sender: 'system',
        content: `Agent ${agent.displayName} joined the conversation`,
      });

      // Notify visitor via Redis
      await redis.publish('agent:message', {
        visitorId: conv.visitor_id,
        content: `${agent.displayName} se ha unido a la conversación.`,
        agentName: agent.displayName,
        timestamp: new Date().toISOString(),
      });

      // Send conversation history to agent
      const messages = await db.getMessages(conv.id);
      send(ws, 'conversation_accepted', {
        conversation: conv,
        messages: messages.map((m) => ({
          sender: m.sender,
          content: m.content,
          timestamp: m.created_at,
        })),
      });

      // Track + webhook
      db.trackEvent({ eventType: 'agent_accepted', conversationId: conv.id, agentId: agent.id }).catch(() => {});
      triggerWebhooks('agent.assigned', { conversationId: conv.id, agentId: agent.id, agentName: agent.displayName }).catch(() => {});

      // Notify other agents to remove from queue
      for (const [otherId, otherWs] of agents) {
        if (otherId !== agent.id) {
          send(otherWs, 'queue_remove', { conversationId: conv.id });
        }
      }
      break;
    }

    case 'send_message': {
      if (!msg.conversationId || !msg.content) {
        send(ws, 'error', { message: 'conversationId and content required' });
        return;
      }

      let content = msg.content;

      // Expand canned responses: if message starts with / look up shortcut
      if (content.startsWith('/')) {
        const shortcut = content.slice(1).trim();
        const canned = await db.query(
          `UPDATE canned_responses SET usage_count = usage_count + 1
           WHERE shortcut = $1 RETURNING content`,
          [shortcut]
        );
        if (canned.rows[0]) content = canned.rows[0].content;
      }

      const conv = await db.getConversation(msg.conversationId);
      if (!conv) {
        send(ws, 'error', { message: 'Conversation not found' });
        return;
      }

      // Agent sends message to visitor
      await db.saveMessage({
        conversationId: conv.id,
        sender: 'agent',
        content,
        metadata: { agentId: agent.id, agentName: agent.displayName },
      });

      await redis.publish('agent:message', {
        visitorId: conv.visitor_id,
        content,
        agentName: agent.displayName,
        timestamp: new Date().toISOString(),
      });
      triggerWebhooks('message.sent', { conversationId: conv.id, sender: 'agent', agentId: agent.id, content }).catch(() => {});
      break;
    }

    case 'list_canned': {
      // Agent requests available canned responses
      const conv = msg.conversationId ? await db.getConversation(msg.conversationId) : null;
      const canned = await db.query(
        `SELECT shortcut, title, content, category FROM canned_responses
         WHERE (language = $1 OR language IS NULL)
         AND (business_line = $2 OR business_line IS NULL)
         ORDER BY usage_count DESC LIMIT 50`,
        [conv?.language || 'es', conv?.business_line]
      );
      send(ws, 'canned_responses', { responses: canned.rows });
      break;
    }

    case 'close_conversation': {
      if (!msg.conversationId) {
        send(ws, 'error', { message: 'conversationId required' });
        return;
      }

      const conv = await db.getConversation(msg.conversationId);
      if (!conv || conv.state === 'closed') {
        send(ws, 'error', { message: 'Conversation not found or already closed' });
        return;
      }

      await transition(msg.conversationId, 'close');

      // Only set online if agent has no other active conversations
      const otherActive = await db.query(
        `SELECT 1 FROM conversations WHERE agent_id = $1 AND state != 'closed' AND closed_at IS NULL AND id != $2 LIMIT 1`,
        [agent.id, msg.conversationId]
      );
      if (otherActive.rows.length === 0) {
        await db.updateAgentStatus(agent.id, 'online');
      }

      if (conv.visitor_id) {
        await redis.publish('agent:message', {
          visitorId: conv.visitor_id,
          content: 'La conversación ha sido cerrada por el agente.',
          agentName: null,
          timestamp: new Date().toISOString(),
        });
      }

      db.trackEvent({ eventType: 'conversation_closed', conversationId: msg.conversationId, agentId: agent.id }).catch(() => {});
      triggerWebhooks('conversation.closed', { conversationId: msg.conversationId, agentId: agent.id }).catch(() => {});
      dispatchToCRM('conversation_closed', { conversationId: msg.conversationId, agentId: agent.id }).catch(() => {});
      break;
    }

    case 'set_status': {
      await db.updateAgentStatus(agent.id, msg.status);
      send(ws, 'status_updated', { status: msg.status });
      break;
    }
  }
}

module.exports = { initAgentHandler };
