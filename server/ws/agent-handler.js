const { logger } = require('../utils/logger');
const { db } = require('../utils/db');
const { redis } = require('../utils/redis');
const { verifyToken } = require('../middleware/auth');
const { transition } = require('../state/conversation-fsm');
const { triggerWebhooks } = require('../integrations/webhooks');
const { dispatchToCRM } = require('../integrations/crm');
const { aiComplete } = require('../services/ai');
const { sessionStore } = require('../state/session-store');
const { generateSuggestedReplies } = require('../services/suggested-replies');
const { sendConversationSummary } = require('../services/email');

// Map of agentId -> ws
const agents = new Map();

// Wallboard clients: Set of ws connections that receive periodic updates
const wallboardClients = new Set();

/** Wallboard push interval (5 seconds) */
const WALLBOARD_INTERVAL = 5000;
const MAX_BUFFERED_BYTES = 512 * 1024;

function send(ws, type, data) {
  if (ws.readyState !== 1) return;
  if (ws.bufferedAmount > MAX_BUFFERED_BYTES) {
    try { ws.close(1013, 'Backpressure'); } catch {}
    return;
  }
  ws.send(JSON.stringify({ type, ...data }));
}

/**
 * Fetch wallboard data (same logic as /api/wallboard route).
 * Imported lazily to avoid circular dependency.
 */
async function getWallboardData() {
  try {
    // We duplicate the aggregation logic here for WS push to avoid HTTP round-trip.
    // This is a simplified version — the full logic lives in server/routes/wallboard.js.
    const { callQueue } = require('../services/call-queue');

    const SLA_TARGET = parseInt(process.env.SLA_TARGET || '80', 10);
    const SLA_THRESHOLD_SECONDS = parseInt(process.env.SLA_THRESHOLD_SECONDS || '180', 10);
    const BU_META = {
      boostic: { label: 'Boostic — SEO & Growth', emoji: '☀️', color: '#10B981' },
      binnacle: { label: 'Binnacle — BI & Analytics', emoji: '📊', color: '#6366F1' },
      marketing: { label: 'Marketing — Digital Marketing', emoji: '📣', color: '#F59E0B' },
      tech: { label: 'Tech — Development', emoji: '⚙️', color: '#3B82F6' },
    };

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const ts = todayStart.toISOString();

    const [queueStats, callsR, chatsR, leadsR, callbacksR, csatR, agentsR] = await Promise.all([
      callQueue.getAllQueueStats(),
      db.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'ended' AND answered_at IS NOT NULL) AS answered, COUNT(*) FILTER (WHERE status IN ('missed','failed')) AS missed FROM calls WHERE created_at >= $1`, [ts]),
      db.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE state = 'closed') AS resolved, COUNT(*) FILTER (WHERE agent_id IS NOT NULL AND state != 'closed') AS escalated FROM conversations WHERE started_at >= $1`, [ts]),
      db.query(`SELECT COUNT(*) FROM leads WHERE created_at >= $1`, [ts]),
      db.query(`SELECT COUNT(*) FROM callbacks WHERE created_at >= $1`, [ts]),
      db.query(`SELECT AVG((data->>'rating')::numeric) AS avg_rating FROM analytics_events WHERE event_type = 'csat' AND created_at >= $1`, [ts]),
      db.query(`
        SELECT a.id, a.display_name, a.status, a.business_lines, a.last_seen_at,
          (SELECT COUNT(*) FROM calls c WHERE c.agent_id = a.id AND c.created_at >= $1) AS today_calls,
          (SELECT COUNT(*) FROM conversations c WHERE c.agent_id = a.id AND c.started_at >= $1) AS today_chats,
          (SELECT AVG((ae.data->>'rating')::numeric) FROM analytics_events ae WHERE ae.agent_id = a.id AND ae.event_type = 'csat' AND ae.created_at >= $1) AS avg_csat
        FROM agents a WHERE a.status != 'offline' OR a.last_seen_at >= $1
        ORDER BY CASE a.status WHEN 'online' THEN 1 WHEN 'busy' THEN 2 WHEN 'away' THEN 3 ELSE 4 END, a.display_name
      `, [ts]),
    ]);

    const callRow = callsR.rows[0] || {};
    const chatRow = chatsR.rows[0] || {};
    const totalChats = parseInt(chatRow.total) || 0;
    const leadsCount = parseInt(leadsR.rows[0]?.count) || 0;

    const todayStats = {
      totalCalls: parseInt(callRow.total) || 0,
      answeredCalls: parseInt(callRow.answered) || 0,
      missedCalls: parseInt(callRow.missed) || 0,
      totalChats,
      resolvedChats: parseInt(chatRow.resolved) || 0,
      escalatedChats: parseInt(chatRow.escalated) || 0,
      leads: leadsCount,
      callbacks: parseInt(callbacksR.rows[0]?.count) || 0,
      avgCsat: parseFloat(csatR.rows[0]?.avg_rating) || 0,
      avgWaitTime: 0,
      avgCallDuration: 0,
      avgChatResponseTime: 0,
      conversionRate: totalChats > 0 ? parseFloat(((leadsCount / totalChats) * 100).toFixed(1)) : 0,
    };

    // Build agents array
    const agentsList = agentsR.rows.map((r) => ({
      id: r.id,
      name: r.display_name,
      status: r.status === 'busy' ? 'on_call' : r.status,
      businessLine: (r.business_lines && r.business_lines[0]) || 'general',
      businessLines: r.business_lines || [],
      currentCall: null,
      avgCsat: parseFloat(r.avg_csat) || 0,
      todayCalls: parseInt(r.today_calls) || 0,
      todayChats: parseInt(r.today_chats) || 0,
    }));

    // Build queues
    const businessLines = ['boostic', 'binnacle', 'marketing', 'tech'];
    const queues = businessLines.map((bl) => {
      const qName = `queue-${bl}`;
      const stats = queueStats[qName] || { waiting: 0, agentsOnline: 0, longestWaitSeconds: 0 };
      const meta = BU_META[bl];
      return {
        name: bl,
        label: meta.label,
        emoji: meta.emoji,
        color: meta.color,
        activeCalls: 0,
        activeChats: 0,
        inQueue: stats.waiting,
        agentsOnline: stats.agentsOnline,
        avgWaitTime: stats.longestWaitSeconds || 0,
        slaPercent: SLA_TARGET,
      };
    });

    const totalInQueue = Object.values(queueStats).reduce((sum, q) => sum + q.waiting, 0);
    const agentsOnline = agentsList.filter((a) => a.status !== 'offline').length;

    return {
      timestamp: new Date().toISOString(),
      global: {
        activeCalls: agentsList.filter((a) => a.status === 'on_call').length,
        activeChats: agentsList.filter((a) => a.status === 'busy').length,
        inQueue: totalInQueue,
        agentsOnline,
        agentsTotal: agentsList.length,
        slaPercent: SLA_TARGET,
        slaTarget: SLA_TARGET,
        todayStats,
      },
      queues,
      agents: agentsList,
      alerts: [],
      hourlyVolume: [],
    };
  } catch (e) {
    logger.warn('Wallboard WS data fetch error:', e.message);
    return null;
  }
}

// Start wallboard push interval
let wallboardTimer = null;

function startWallboardPush() {
  if (wallboardTimer) return;
  wallboardTimer = setInterval(async () => {
    if (wallboardClients.size === 0) return;
    const data = await getWallboardData();
    if (!data) return;
    for (const ws of wallboardClients) {
      send(ws, 'wallboard_update', { data });
    }
  }, WALLBOARD_INTERVAL);
  logger.info(`Wallboard: push timer started (${WALLBOARD_INTERVAL}ms interval)`);
}

function stopWallboardPush() {
  if (wallboardTimer && wallboardClients.size === 0) {
    clearInterval(wallboardTimer);
    wallboardTimer = null;
    logger.info('Wallboard: push timer stopped (no clients)');
  }
}

function initAgentHandler(wss) {
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    const role = url.searchParams.get('role');

    let agent;
    try {
      agent = verifyToken(token);
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    // ─── Wallboard client mode ───
    if (role === 'wallboard') {
      wallboardClients.add(ws);
      logger.info(`Wallboard WS connected: ${agent.username}`);
      startWallboardPush();

      // Send immediate first push
      getWallboardData().then((data) => {
        if (data) send(ws, 'wallboard_update', { data });
      }).catch(() => {});

      ws.on('close', () => {
        wallboardClients.delete(ws);
        logger.info(`Wallboard WS disconnected: ${agent.username}`);
        stopWallboardPush();
      });

      // Wallboard clients don't process agent messages
      return;
    }

    // ─── Normal agent client ───
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

  // Listen for visitor typing indicator
  redis.subscribe('visitor:typing', (data) => {
    db.getConversation(data.conversationId).then((conv) => {
      if (conv?.agent_id) {
        const ws = agents.get(conv.agent_id);
        if (ws) {
          send(ws, 'visitor_typing', {
            conversationId: data.conversationId,
            isTyping: data.isTyping,
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

  // Listen for incoming call requests from visitors
  redis.subscribe('call:incoming', (data) => {
    // Broadcast to all connected agents
    for (const [agentId, ws] of agents) {
      send(ws, 'incoming_call', {
        callId: data.callId,
        conversationId: data.conversationId,
        visitorId: data.visitorId,
        language: data.language,
        businessLine: data.businessLine,
      });
    }
  }).catch((e) => logger.warn('Redis subscribe error (call:incoming):', e.message));
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

      // AI-generated conversation summary for agent context
      let summary = null;
      try {
        if (messages.length >= 3) {
          const historyText = messages
            .filter((m) => m.sender !== 'system')
            .map((m) => `${m.sender === 'visitor' ? 'Visitante' : 'Bot'}: ${m.content}`)
            .join('\n');
          summary = await aiComplete(
            'Eres un asistente que resume conversaciones de chat. Resume en 2-3 bullet points concisos los puntos clave de la conversación. Identifica: qué necesita el visitante, qué línea de negocio le interesa, y si dejó datos de contacto. Responde en español.',
            `Resume esta conversación:\n\n${historyText}`,
            { maxTokens: 256, temperature: 0.2 }
          );
        }
      } catch (e) {
        logger.warn('Failed to generate conversation summary:', e.message);
      }

      // Visitor page context for agent sidebar
      let visitorContext = null;
      try {
        const session = await sessionStore.get(conv.visitor_id);
        if (session?.pageContext) {
          visitorContext = session.pageContext;
        }
      } catch {}

      send(ws, 'conversation_accepted', {
        conversation: conv,
        messages: messages.map((m) => ({
          id: m.id,
          sender: m.sender,
          content: m.content,
          timestamp: m.created_at,
          metadata: m.metadata,
        })),
        summary,
        visitorContext,
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
        if (canned.rows[0]) {
          content = canned.rows[0].content;
        } else {
          send(ws, 'error', { message: `Atajo "/${shortcut}" no encontrado` });
          return;
        }
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

      // Send conversation summary email to BU contacts
      sendConversationSummary(msg.conversationId).catch((e) => logger.warn('Summary email error:', e.message));
      break;
    }

    case 'set_status': {
      await db.updateAgentStatus(agent.id, msg.status);
      send(ws, 'status_updated', { status: msg.status });
      break;
    }

    case 'internal_note': {
      // Internal notes: visible only to agents, never sent to visitors
      if (!msg.conversationId || !msg.content) {
        send(ws, 'error', { message: 'conversationId and content required' });
        return;
      }
      const noteConv = await db.getConversation(msg.conversationId);
      if (!noteConv) {
        send(ws, 'error', { message: 'Conversation not found' });
        return;
      }
      const note = await db.saveMessage({
        conversationId: msg.conversationId,
        sender: 'note',
        content: msg.content,
        metadata: { agentId: agent.id, agentName: agent.displayName, internal: true },
      });
      // Broadcast to all connected agents (not visitors)
      for (const [agentId, agentWs] of agents) {
        send(agentWs, 'internal_note', {
          conversationId: msg.conversationId,
          content: msg.content,
          agentName: agent.displayName,
          timestamp: note.created_at,
        });
      }
      break;
    }

    case 'mark_read': {
      // Agent marks visitor messages as read — notify visitor
      if (!msg.conversationId) return;
      const readConv = await db.getConversation(msg.conversationId);
      if (!readConv?.visitor_id) return;
      await redis.publish('message:read', {
        visitorId: readConv.visitor_id,
        conversationId: msg.conversationId,
        agentId: agent.id,
        timestamp: new Date().toISOString(),
      });
      break;
    }

    case 'typing': {
      // Agent typing indicator — relay to visitor
      if (!msg.conversationId) return;
      const typConv = await db.getConversation(msg.conversationId);
      if (!typConv?.visitor_id) return;
      await redis.publish('agent:typing', {
        visitorId: typConv.visitor_id,
        conversationId: msg.conversationId,
        agentName: agent.displayName,
        isTyping: !!msg.isTyping,
      });
      break;
    }

    case 'transfer_conversation': {
      // Transfer conversation to another agent
      const { conversationId, targetAgentId, reason } = msg;
      if (!conversationId || !targetAgentId) {
        send(ws, 'error', { message: 'conversationId and targetAgentId required' });
        return;
      }

      const xConv = await db.getConversation(conversationId);
      if (!xConv || xConv.state === 'closed') {
        send(ws, 'error', { message: 'Conversation not found or closed' });
        return;
      }

      // Get target agent info
      const targetAgent = await db.getAgent(targetAgentId);
      if (!targetAgent || targetAgent.status === 'offline') {
        send(ws, 'error', { message: 'Target agent unavailable' });
        return;
      }

      // Update assignment
      await db.query(
        'UPDATE conversations SET agent_id = $1, updated_at = NOW() WHERE id = $2',
        [targetAgentId, conversationId]
      );

      // Save transfer note
      const transferNote = `Transferida de ${agent.displayName} a ${targetAgent.display_name}${reason ? ': ' + reason : ''}`;
      await db.saveMessage({
        conversationId,
        sender: 'system',
        content: transferNote,
      });

      // Notify target agent
      const targetWs = agents.get(targetAgentId);
      if (targetWs) {
        const messages = await db.getMessages(conversationId);
        send(targetWs, 'conversation_transferred', {
          conversation: { ...xConv, agent_id: targetAgentId },
          messages: messages.map((m) => ({
            id: m.id, sender: m.sender, content: m.content,
            timestamp: m.created_at, metadata: m.metadata,
          })),
          fromAgent: agent.displayName,
          reason,
        });
      }

      // Notify visitor
      if (xConv.visitor_id) {
        await redis.publish('agent:message', {
          visitorId: xConv.visitor_id,
          content: `${targetAgent.display_name} te va a atender a partir de ahora.`,
          agentName: targetAgent.display_name,
          timestamp: new Date().toISOString(),
        });
      }

      // Confirm to source agent
      send(ws, 'transfer_complete', {
        conversationId,
        targetAgent: targetAgent.display_name,
      });

      db.trackEvent({ eventType: 'conversation_transferred', conversationId, agentId: agent.id, data: { targetAgentId, reason } }).catch(() => {});
      triggerWebhooks('agent.transferred', { conversationId, fromAgentId: agent.id, toAgentId: targetAgentId, reason }).catch(() => {});
      break;
    }

    case 'add_tags': {
      // Add tags to conversation
      if (!msg.conversationId || !Array.isArray(msg.tags)) {
        send(ws, 'error', { message: 'conversationId and tags[] required' });
        return;
      }
      const sanitizedTags = msg.tags
        .filter((t) => typeof t === 'string')
        .map((t) => t.slice(0, 50).toLowerCase().trim())
        .filter(Boolean);
      if (sanitizedTags.length === 0) return;

      await db.query(
        `UPDATE conversations SET tags = array_cat(tags, $1::text[]), updated_at = NOW() WHERE id = $2`,
        [sanitizedTags, msg.conversationId]
      );

      // Broadcast to all agents
      for (const [, agentWs] of agents) {
        send(agentWs, 'tags_updated', { conversationId: msg.conversationId, tags: sanitizedTags, action: 'added' });
      }
      break;
    }

    case 'remove_tag': {
      if (!msg.conversationId || !msg.tag) return;
      await db.query(
        `UPDATE conversations SET tags = array_remove(tags, $1), updated_at = NOW() WHERE id = $2`,
        [msg.tag, msg.conversationId]
      );
      for (const [, agentWs] of agents) {
        send(agentWs, 'tags_updated', { conversationId: msg.conversationId, tag: msg.tag, action: 'removed' });
      }
      break;
    }

    case 'set_priority': {
      // Set conversation priority (0=normal, 1=high, 2=urgent)
      if (!msg.conversationId || typeof msg.priority !== 'number') return;
      const prio = Math.max(0, Math.min(3, Math.round(msg.priority)));
      await db.query(
        'UPDATE conversations SET priority = $1, updated_at = NOW() WHERE id = $2',
        [prio, msg.conversationId]
      );
      for (const [, agentWs] of agents) {
        send(agentWs, 'priority_updated', { conversationId: msg.conversationId, priority: prio });
      }
      break;
    }

    case 'get_suggestions': {
      // AI-generated reply suggestions
      if (!msg.conversationId) return;
      const suggestions = await generateSuggestedReplies(msg.conversationId);
      send(ws, 'suggested_replies', {
        conversationId: msg.conversationId,
        suggestions,
      });
      break;
    }

    case 'accept_call': {
      // Agent accepts an incoming call
      if (!msg.callId) {
        send(ws, 'error', { message: 'callId required' });
        return;
      }

      // Update call record
      try {
        await db.query(
          `UPDATE calls SET agent_id = $1, status = 'active', answered_at = NOW() WHERE call_id = $2`,
          [agent.id, msg.callId]
        );
      } catch (e) {
        logger.warn('Failed to update call record:', e.message);
      }

      // Notify visitor via Redis that agent accepted
      await redis.publish('call:accepted', {
        callId: msg.callId,
        agentId: agent.id,
        agentName: agent.displayName,
      });

      // Send SIP config to agent for connecting to /ws/sip
      send(ws, 'call_config', {
        callId: msg.callId,
        sipConfig: {
          wssUrl: `${process.env.SIP_WSS_URL || 'ws://localhost:3000'}`,
          domain: process.env.SIP_DOMAIN || 'localhost',
        },
      });

      // Notify other agents that call was taken
      for (const [otherId, otherWs] of agents) {
        if (otherId !== agent.id) {
          send(otherWs, 'call_taken', { callId: msg.callId, agentName: agent.displayName });
        }
      }

      db.trackEvent({ eventType: 'call_accepted', data: { callId: msg.callId, agentId: agent.id } }).catch(() => {});
      triggerWebhooks('call.accepted', { callId: msg.callId, agentId: agent.id }).catch(() => {});
      break;
    }

    case 'reject_call': {
      // Agent rejects a call
      if (!msg.callId) return;
      await redis.publish('call:rejected', {
        callId: msg.callId,
        reason: 'Agent rejected',
      });
      break;
    }

    case 'hangup_call': {
      // Agent hangs up an active call
      if (!msg.callId) return;
      // The sip-signaling handler will handle the actual call cleanup
      // This just updates the database
      try {
        await db.query(
          `UPDATE calls SET status = 'ended', ended_at = NOW() WHERE call_id = $1`,
          [msg.callId]
        );
      } catch (e) {
        logger.warn('Failed to end call record:', e.message);
      }
      break;
    }
  }
}

module.exports = { initAgentHandler };
