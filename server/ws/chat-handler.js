const { v4: uuid } = require('uuid');
const { logger } = require('../utils/logger');
const { db } = require('../utils/db');
const { redis } = require('../utils/redis');
const { t } = require('../utils/i18n');
const { sessionStore } = require('../state/session-store');
const { transition } = require('../state/conversation-fsm');
const { detectLanguage } = require('../services/language-detector');
const { generateResponse, detectBusinessLine, isBusinessHours } = require('../services/router');

// Map of visitorId -> ws
const visitors = new Map();

function send(ws, type, data) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type, ...data }));
  }
}

function initChatHandler(wss) {
  wss.on('connection', (ws, req) => {
    const visitorId = new URL(req.url, 'http://localhost').searchParams.get('visitorId') || uuid();
    visitors.set(visitorId, ws);
    logger.info(`Chat WS connected: ${visitorId}`);

    // Send initial config
    send(ws, 'connected', {
      visitorId,
      isBusinessHours: isBusinessHours(),
    });

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw);
        await handleMessage(ws, visitorId, msg);
      } catch (e) {
        logger.error(`Chat WS error (${visitorId}):`, e);
        send(ws, 'error', { message: 'Error processing message' });
      }
    });

    ws.on('close', () => {
      visitors.delete(visitorId);
      logger.info(`Chat WS disconnected: ${visitorId}`);
    });
  });

  // Listen for agent messages via Redis pub/sub
  redis.subscribe('agent:message', (data) => {
    const ws = visitors.get(data.visitorId);
    if (ws) {
      send(ws, 'message', {
        sender: 'agent',
        content: data.content,
        agentName: data.agentName,
        timestamp: data.timestamp,
      });
    }
  }).catch((e) => logger.warn('Redis subscribe error:', e.message));
}

async function handleMessage(ws, visitorId, msg) {
  switch (msg.type) {
    case 'chat': return handleChat(ws, visitorId, msg);
    case 'set_language': return handleSetLanguage(ws, visitorId, msg);
    case 'set_business_line': return handleSetBusinessLine(ws, visitorId, msg);
    case 'lead_submit': return handleLeadSubmit(ws, visitorId, msg);
    case 'offline_form': return handleOfflineForm(ws, visitorId, msg);
    case 'escalate': return handleEscalate(ws, visitorId);
    case 'request_call': return handleRequestCall(ws, visitorId);
    case 'csat': return handleCsat(ws, visitorId, msg);
    default:
      logger.warn(`Unknown message type: ${msg.type}`);
  }
}

async function handleChat(ws, visitorId, msg) {
  const session = (await sessionStore.get(visitorId)) || {};
  let conv = await db.getActiveConversation(visitorId);

  // Detect language from first message
  if (!session.language) {
    session.language = detectLanguage(msg.content);
    await sessionStore.update(visitorId, { language: session.language });
    send(ws, 'language_detected', { language: session.language });
  }

  const language = session.language || 'es';

  // Create conversation if needed
  if (!conv) {
    const detectedLine = detectBusinessLine(msg.content);
    conv = await db.createConversation({
      visitorId,
      language,
      businessLine: detectedLine,
    });
    await transition(conv.id, 'start');
    conv.state = 'chat_active';

    // Track event
    db.trackEvent({ eventType: 'conversation_started', conversationId: conv.id, visitorId, language, businessLine: detectedLine }).catch(() => {});
  }

  // Detect and update business line if not set
  if (!conv.business_line) {
    const detectedLine = detectBusinessLine(msg.content);
    if (detectedLine) {
      await db.updateConversation(conv.id, { business_line: detectedLine });
      conv.business_line = detectedLine;
    }
  }

  // Save visitor message
  await db.saveMessage({ conversationId: conv.id, sender: 'visitor', content: msg.content });

  // If agent is assigned, relay to agent via Redis
  if (conv.agent_id && conv.state === 'chat_active') {
    await redis.publish('visitor:message', {
      conversationId: conv.id,
      visitorId,
      content: msg.content,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Bot response
  send(ws, 'typing', { isTyping: true });

  const history = await db.getMessages(conv.id, 10);
  const { response, detectedLine } = await generateResponse({
    message: msg.content,
    language,
    businessLine: conv.business_line || detectedLine,
    conversationHistory: history,
  });

  // Update business line if newly detected
  if (detectedLine && detectedLine !== conv.business_line) {
    await db.updateConversation(conv.id, { business_line: detectedLine });
  }

  // Save bot message
  await db.saveMessage({ conversationId: conv.id, sender: 'bot', content: response });

  send(ws, 'typing', { isTyping: false });
  send(ws, 'message', {
    sender: 'bot',
    content: response,
    timestamp: new Date().toISOString(),
  });
}

async function handleSetLanguage(ws, visitorId, msg) {
  await sessionStore.update(visitorId, { language: msg.language });
  send(ws, 'language_set', { language: msg.language });
}

async function handleSetBusinessLine(ws, visitorId, msg) {
  const conv = await db.getActiveConversation(visitorId);
  if (conv) {
    await db.updateConversation(conv.id, { business_line: msg.businessLine });
  }
  await sessionStore.update(visitorId, { businessLine: msg.businessLine });
  send(ws, 'business_line_set', { businessLine: msg.businessLine });
}

async function handleLeadSubmit(ws, visitorId, msg) {
  const session = (await sessionStore.get(visitorId)) || {};
  const conv = await db.getActiveConversation(visitorId);

  const lead = await db.saveLead({
    conversationId: conv?.id,
    name: msg.name,
    email: msg.email,
    phone: msg.phone,
    company: msg.company,
    businessLine: conv?.business_line || session.businessLine,
    language: session.language || 'es',
  });

  db.trackEvent({ eventType: 'lead_captured', conversationId: conv?.id, visitorId, businessLine: conv?.business_line, data: { leadId: lead.id } }).catch(() => {});

  const lang = session.language || 'es';
  send(ws, 'lead_saved', { message: t(lang, 'lead_thanks', { name: msg.name }) });
}

async function handleOfflineForm(ws, visitorId, msg) {
  // Outside business hours: save as lead with offline flag
  const lead = await db.saveLead({
    conversationId: null,
    name: msg.name,
    email: msg.email,
    phone: msg.phone || null,
    company: null,
    businessLine: null,
    language: msg.language || 'es',
  });

  // Save optional message as note
  if (msg.message) {
    await db.updateLead(lead.id, { notes: msg.message, metadata: { source: 'offline_form' } });
  }

  db.trackEvent({ eventType: 'offline_form', visitorId, data: { leadId: lead.id } }).catch(() => {});

  const lang = msg.language || 'es';
  send(ws, 'offline_form_saved', { message: t(lang, 'offline_form_thanks') });
}

async function handleEscalate(ws, visitorId) {
  const conv = await db.getActiveConversation(visitorId);
  if (!conv) return;

  const session = (await sessionStore.get(visitorId)) || {};
  const lang = session.language || conv.language || 'es';

  // Check for available agents
  const agents = await db.getAvailableAgents({
    language: lang,
    businessLine: conv.business_line,
  });

  if (agents.length === 0) {
    send(ws, 'message', {
      sender: 'system',
      content: t(lang, 'no_agents'),
      timestamp: new Date().toISOString(),
    });
    return;
  }

  await transition(conv.id, 'escalate');
  send(ws, 'escalating', { message: t(lang, 'agent_connecting') });

  // Notify agents via Redis
  await redis.publish('queue:new', {
    conversationId: conv.id,
    visitorId,
    language: lang,
    businessLine: conv.business_line,
  });

  db.trackEvent({ eventType: 'escalation_requested', conversationId: conv.id, visitorId, businessLine: conv.business_line }).catch(() => {});
}

async function handleRequestCall(ws, visitorId) {
  const conv = await db.getActiveConversation(visitorId);
  if (!conv) return;

  // VoIP only during business hours
  if (!isBusinessHours()) {
    const session = (await sessionStore.get(visitorId)) || {};
    const lang = session.language || 'es';
    send(ws, 'message', {
      sender: 'system',
      content: t(lang, 'offline_message', {
        start: process.env.BUSINESS_HOURS_START || '9',
        end: process.env.BUSINESS_HOURS_END || '19',
      }),
      timestamp: new Date().toISOString(),
    });
    send(ws, 'show_offline_form', {});
    return;
  }

  await transition(conv.id, 'request_call');
  send(ws, 'call_ready', { conversationId: conv.id });
}

async function handleCsat(ws, visitorId, msg) {
  const conv = await db.getActiveConversation(visitorId);
  const session = (await sessionStore.get(visitorId)) || {};
  const lang = session.language || 'es';

  db.trackEvent({
    eventType: 'csat',
    conversationId: conv?.id,
    visitorId,
    data: { rating: msg.rating, comment: msg.comment },
  }).catch(() => {});

  send(ws, 'message', {
    sender: 'system',
    content: t(lang, 'csat_thanks'),
    timestamp: new Date().toISOString(),
  });
}

// Helper: send message to visitor from agent/system
async function sendToVisitor(visitorId, sender, content) {
  const ws = visitors.get(visitorId);
  if (ws) {
    send(ws, 'message', { sender, content, timestamp: new Date().toISOString() });
  }
}

module.exports = { initChatHandler, sendToVisitor };
