const { logger } = require('../utils/logger');
const { verifyToken } = require('../middleware/auth');
const { db } = require('../utils/db');
const { redis } = require('../utils/redis');
const { triggerWebhooks } = require('../integrations/webhooks');

// Active call sessions: callId -> { visitor: ws, agent: ws, startedAt, conversationId }
const activeCalls = new Map();
// Participant lookup: ws -> { role, callId, id }
const participants = new Map();

function send(ws, type, data = {}) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type, ...data }));
  }
}

function getPeer(ws) {
  const info = participants.get(ws);
  if (!info) return null;
  const call = activeCalls.get(info.callId);
  if (!call) return null;
  return info.role === 'visitor' ? call.agent : call.visitor;
}

function initSipSignaling(wss) {
  // Listen for call accepted by agent (from agent-handler via Redis)
  redis.subscribe('call:accepted', (data) => {
    const call = activeCalls.get(data.callId);
    if (call?.visitor) {
      send(call.visitor, 'call_accepted', { agentName: data.agentName });
    }
  }).catch((e) => logger.warn('Redis subscribe error (call:accepted):', e.message));

  // Listen for call rejected
  redis.subscribe('call:rejected', (data) => {
    const call = activeCalls.get(data.callId);
    if (call?.visitor) {
      send(call.visitor, 'call_rejected', { reason: data.reason || 'No agents available' });
      cleanupCall(data.callId);
    }
  }).catch((e) => logger.warn('Redis subscribe error (call:rejected):', e.message));

  wss.on('connection', async (ws, req) => {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const role = params.get('role'); // 'visitor' or 'agent'
    const callId = params.get('callId');

    if (!role || !callId) {
      ws.close(4001, 'Missing role or callId');
      return;
    }

    // Agent connections require token verification
    let agentInfo = null;
    if (role === 'agent') {
      const token = params.get('token');
      try {
        agentInfo = verifyToken(token);
      } catch {
        ws.close(4001, 'Invalid agent token');
        return;
      }
    }

    // Visitor connections require visitorId and callId must exist in DB or activeCalls
    if (role === 'visitor') {
      const visitorId = params.get('visitorId');
      if (!visitorId || visitorId.length < 8) {
        ws.close(4002, 'Missing or invalid visitorId');
        return;
      }
      // Verify callId exists (registered by chat-handler or already in activeCalls)
      if (!activeCalls.has(callId)) {
        try {
          const result = await db.query('SELECT 1 FROM calls WHERE call_id = $1 LIMIT 1', [callId]);
          if (result.rows.length === 0) {
            ws.close(4003, 'Unknown callId');
            return;
          }
        } catch (e) {
          logger.warn('SIP visitor auth DB check failed:', e.message);
          ws.close(4003, 'Unknown callId');
          return;
        }
      }
    }

    const participantId = role === 'agent' ? agentInfo?.id : params.get('visitorId');
    participants.set(ws, { role, callId, id: participantId });

    // Register in call session
    if (!activeCalls.has(callId)) {
      activeCalls.set(callId, {
        visitor: null,
        agent: null,
        startedAt: null,
        conversationId: null,
      });
    }
    const call = activeCalls.get(callId);
    call[role] = ws;

    logger.info(`Call signaling connected: ${role} for call ${callId.slice(0, 8)}`);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        handleSignal(ws, msg);
      } catch (e) {
        logger.warn(`Invalid signal from ${role}:`, e.message);
      }
    });

    ws.on('close', () => {
      const info = participants.get(ws);
      if (info) {
        // Notify peer that the other side disconnected
        const peer = getPeer(ws);
        if (peer) {
          send(peer, 'call_ended', { reason: `${info.role} disconnected` });
        }
        // Record call end
        endCall(info.callId, 'disconnect');
        participants.delete(ws);
      }
      logger.info(`Call signaling disconnected: ${role} for call ${callId.slice(0, 8)}`);
    });
  });
}

function handleSignal(ws, msg) {
  const info = participants.get(ws);
  if (!info) return;
  const peer = getPeer(ws);

  switch (msg.type) {
    case 'register': {
      // Visitor or agent registered on signaling channel
      logger.debug(`${info.role} registered for call ${info.callId.slice(0, 8)}`);
      break;
    }

    case 'start_call': {
      // Visitor initiates the call — server already routed via chat-handler
      // Just confirm readiness
      const call = activeCalls.get(info.callId);
      if (call) {
        call.startedAt = new Date();
      }
      break;
    }

    case 'webrtc_offer': {
      // Visitor sends SDP offer → relay to agent
      if (peer) {
        send(peer, 'webrtc_offer', { sdp: msg.sdp });
      }
      break;
    }

    case 'webrtc_answer': {
      // Agent sends SDP answer → relay to visitor
      if (peer) {
        send(peer, 'webrtc_answer', { sdp: msg.sdp });
      }
      break;
    }

    case 'ice_candidate': {
      // Relay ICE candidate to peer
      if (peer) {
        send(peer, 'ice_candidate', { candidate: msg.candidate });
      }
      break;
    }

    case 'hangup': {
      if (peer) {
        send(peer, 'call_ended', { reason: `${info.role} hung up` });
      }
      endCall(info.callId, 'hangup');
      break;
    }

    default:
      logger.debug(`Unknown signal type: ${msg.type}`);
  }
}

async function endCall(callId, reason) {
  const call = activeCalls.get(callId);
  if (!call) return;

  const duration = call.startedAt
    ? Math.round((Date.now() - call.startedAt.getTime()) / 1000)
    : 0;

  // Record call in database
  try {
    if (call.conversationId) {
      await db.query(
        `UPDATE calls SET status = 'ended', duration_seconds = $1, ended_at = NOW() WHERE call_id = $2`,
        [duration, callId]
      );
    }
  } catch (e) {
    logger.warn('Failed to update call record:', e.message);
  }

  // Webhooks
  triggerWebhooks('call.ended', {
    callId,
    duration,
    reason,
    conversationId: call.conversationId,
  }).catch(() => {});

  // Cleanup
  for (const [ws, info] of participants) {
    if (info.callId === callId) {
      participants.delete(ws);
    }
  }
  activeCalls.delete(callId);

  logger.info(`Call ${callId.slice(0, 8)} ended: ${reason} (${duration}s)`);
}

// Exported for chat-handler to register call sessions
function registerCall(callId, conversationId) {
  if (!activeCalls.has(callId)) {
    activeCalls.set(callId, {
      visitor: null,
      agent: null,
      startedAt: null,
      conversationId,
    });
  } else {
    activeCalls.get(callId).conversationId = conversationId;
  }
}

module.exports = { initSipSignaling, registerCall, activeCalls };
