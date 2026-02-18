const { v4: uuid } = require('uuid');
const { logger } = require('../utils/logger');
const { db } = require('../utils/db');
const { redis } = require('../utils/redis');
const { t } = require('../utils/i18n');
const { sessionStore } = require('../state/session-store');
const { transition } = require('../state/conversation-fsm');
const { detectLanguage } = require('../services/language-detector');
const { generateResponse, detectBusinessLine, isBusinessHours } = require('../services/router');
const { searchKnowledge } = require('../services/knowledge-base');
const { scoreLead } = require('../services/lead-capture');
const { triggerWebhooks } = require('../integrations/webhooks');
const { dispatchToCRM } = require('../integrations/crm');

// Map of visitorId -> ws
const visitors = new Map();

function send(ws, type, data) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type, ...data }));
  }
}

function initChatHandler(wss) {
  wss.on('connection', async (ws, req) => {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const visitorId = params.get('visitorId') || uuid();
    visitors.set(visitorId, ws);
    logger.info(`Chat WS connected: ${visitorId}`);

    // Store page context from connection params
    const pageContext = {
      pageUrl: params.get('pageUrl') || null,
      pageTitle: params.get('pageTitle') || null,
      referrer: params.get('referrer') || null,
    };
    if (pageContext.pageUrl) {
      await sessionStore.update(visitorId, { pageContext }).catch(() => {});
    }

    // Send initial config
    send(ws, 'connected', {
      visitorId,
      isBusinessHours: isBusinessHours(),
    });

    // Chat history persistence: send recent messages if visitor has an active conversation
    try {
      const conv = await db.getActiveConversation(visitorId);
      if (conv) {
        const history = await db.getMessages(conv.id, 30);
        if (history.length > 0) {
          send(ws, 'chat_history', {
            conversationId: conv.id,
            messages: history.map((m) => ({
              id: m.id,
              sender: m.sender,
              content: m.content,
              timestamp: m.created_at,
              metadata: m.metadata,
            })),
            language: conv.language,
            businessLine: conv.business_line,
            state: conv.state,
          });
        }
      }
    } catch (e) {
      logger.warn(`Failed to load chat history for ${visitorId}:`, e.message);
    }

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

  // Listen for read receipts: agent read the visitor's messages
  redis.subscribe('message:read', (data) => {
    const ws = visitors.get(data.visitorId);
    if (ws) {
      send(ws, 'message_status', {
        conversationId: data.conversationId,
        status: 'read',
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
    case 'page_context': return handlePageContext(ws, visitorId, msg);
    case 'search_kb': return handleSearchKB(ws, visitorId, msg);
    case 'quick_reply': return handleQuickReply(ws, visitorId, msg);
    default:
      logger.warn(`Unknown message type: ${msg.type}`);
  }
}

// Page context: visitor sends current URL/title for context-aware greetings
async function handlePageContext(ws, visitorId, msg) {
  const pageContext = {
    pageUrl: typeof msg.pageUrl === 'string' ? msg.pageUrl.slice(0, 500) : null,
    pageTitle: typeof msg.pageTitle === 'string' ? msg.pageTitle.slice(0, 200) : null,
    referrer: typeof msg.referrer === 'string' ? msg.referrer.slice(0, 500) : null,
  };
  await sessionStore.update(visitorId, { pageContext });

  // Auto-detect business line from URL
  const url = (pageContext.pageUrl || '').toLowerCase();
  let detectedLine = null;
  if (/\/seo|\/boostic|\/growth|\/analytics/.test(url)) detectedLine = 'boostic';
  else if (/\/bi|\/binnacle|\/dashboard|\/dato/.test(url)) detectedLine = 'binnacle';
  else if (/\/marketing|\/publicidad|\/ads|\/social/.test(url)) detectedLine = 'marketing';
  else if (/\/desarrollo|\/tech|\/ecommerce|\/shopify|\/magento|\/app/.test(url)) detectedLine = 'tech';

  if (detectedLine) {
    send(ws, 'business_line_detected', { businessLine: detectedLine });
  }
}

// ─── Rich reply builder: auto-attach cards/quick-replies for common intents ───
const RICH_LINE_INFO = {
  boostic:   { title: 'Boostic - SEO & Growth', subtitle: 'Posicionamiento, analítica web y CRO', icon: '📈' },
  binnacle:  { title: 'Binnacle - Business Intelligence', subtitle: 'Dashboards, datos y reporting', icon: '📊' },
  marketing: { title: 'Marketing Digital', subtitle: 'SEM, Social Media y campañas', icon: '📣' },
  tech:      { title: 'Digital Tech', subtitle: 'Desarrollo web, apps y e-commerce', icon: '💻' },
};

function buildRichReply(question, answer, businessLine, language) {
  const q = question.toLowerCase();

  // If asking about services/what you do → quick replies for business lines
  if (/qué (hacéis|hacen|ofrec|servicio)|what (do|service)|quais serviço/i.test(q) && !businessLine) {
    return {
      type: 'quick_replies',
      text: answer,
      replies: Object.entries(RICH_LINE_INFO).map(([id, info]) => ({
        label: `${info.icon} ${info.title.split(' - ')[0] || info.title}`,
        value: `Quiero saber más sobre ${info.title}`,
      })),
    };
  }

  // If a specific line is detected → card with CTA
  if (businessLine && RICH_LINE_INFO[businessLine]) {
    const info = RICH_LINE_INFO[businessLine];
    // Only on first interaction with the line (short conversation)
    if (/cuénta|cuéntame|tell me|info|saber más|más sobre|know more/i.test(q)) {
      return {
        type: 'card',
        title: info.title,
        subtitle: info.subtitle,
        buttons: [
          { label: '📞 Contactar un experto', action: 'postback', value: '__escalate__' },
          { label: '📝 Dejar mis datos', action: 'postback', value: '__lead_form__' },
        ],
      };
    }
  }

  // If asking about contact/pricing → buttons
  if (/precio|presupuesto|coste|cost|price|budget|cotización/i.test(q)) {
    return {
      type: 'buttons',
      text: answer,
      buttons: [
        { label: '💬 Hablar con un agente', action: 'postback', value: '__escalate__' },
        { label: '📝 Solicitar presupuesto', action: 'postback', value: '__lead_form__' },
        { label: '📞 Llamar', action: 'postback', value: '__call__' },
      ],
    };
  }

  return null;
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

    // Track event + webhook
    db.trackEvent({ eventType: 'conversation_started', conversationId: conv.id, visitorId, language, businessLine: detectedLine }).catch(() => {});
    triggerWebhooks('conversation.started', { conversationId: conv.id, visitorId, language, businessLine: detectedLine }).catch(() => {});
  }

  // Detect and update business line if not set
  if (!conv.business_line) {
    const detectedLine = detectBusinessLine(msg.content);
    if (detectedLine) {
      await db.updateConversation(conv.id, { business_line: detectedLine });
      conv.business_line = detectedLine;
    }
  }

  // Save visitor message + webhook
  const savedMsg = await db.saveMessage({ conversationId: conv.id, sender: 'visitor', content: msg.content });
  triggerWebhooks('message.received', { conversationId: conv.id, visitorId, content: msg.content }).catch(() => {});

  // Delivery receipt: confirm the message was received by server
  send(ws, 'message_status', { messageId: savedMsg.id, status: 'delivered', timestamp: new Date().toISOString() });

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

  // Build rich content when applicable
  const richContent = buildRichReply(msg.content, response, detectedLine || conv.business_line, language);

  // Save bot message + webhook
  await db.saveMessage({
    conversationId: conv.id, sender: 'bot', content: response,
    metadata: richContent ? { richContent } : {},
  });
  triggerWebhooks('message.sent', { conversationId: conv.id, sender: 'bot', content: response }).catch(() => {});

  send(ws, 'typing', { isTyping: false });
  send(ws, 'message', {
    sender: 'bot',
    content: response,
    richContent,
    timestamp: new Date().toISOString(),
  });
}

const VALID_LANGUAGES = new Set(['es', 'en', 'pt', 'fr', 'de', 'it', 'nl', 'zh', 'ja', 'ko', 'ar', 'gl']);
const VALID_LINES = new Set(['boostic', 'binnacle', 'marketing', 'tech']);

async function handleSetLanguage(ws, visitorId, msg) {
  if (!msg.language || !VALID_LANGUAGES.has(msg.language)) {
    send(ws, 'error', { message: 'Invalid language' });
    return;
  }
  await sessionStore.update(visitorId, { language: msg.language });
  send(ws, 'language_set', { language: msg.language });
}

async function handleSetBusinessLine(ws, visitorId, msg) {
  if (!msg.businessLine || !VALID_LINES.has(msg.businessLine)) {
    send(ws, 'error', { message: 'Invalid business line' });
    return;
  }
  const conv = await db.getActiveConversation(visitorId);
  if (conv) {
    await db.updateConversation(conv.id, { business_line: msg.businessLine });
  }
  await sessionStore.update(visitorId, { businessLine: msg.businessLine });
  send(ws, 'business_line_set', { businessLine: msg.businessLine });
}

async function handleLeadSubmit(ws, visitorId, msg) {
  // Basic validation
  if (msg.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(msg.email)) {
    send(ws, 'error', { message: 'Invalid email format' });
    return;
  }
  if (!msg.name || msg.name.trim().length < 2) {
    send(ws, 'error', { message: 'Name is required' });
    return;
  }

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

  // Score lead + dispatch to CRM + trigger webhooks
  scoreLead(lead.id).catch(() => {});
  dispatchToCRM('lead_created', { lead, conversation: conv }).catch((e) => logger.warn('CRM dispatch error:', e.message));
  triggerWebhooks('lead.created', { lead, visitorId, businessLine: conv?.business_line }).catch(() => {});

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

  // Score lead + dispatch to CRM + trigger webhooks
  scoreLead(lead.id).catch(() => {});
  dispatchToCRM('lead_created', { lead, conversation: null }).catch((e) => logger.warn('CRM dispatch error:', e.message));
  triggerWebhooks('lead.created', { lead, visitorId, source: 'offline_form' }).catch(() => {});

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
  triggerWebhooks('csat.submitted', { conversationId: conv?.id, visitorId, rating: msg.rating, comment: msg.comment }).catch(() => {});

  send(ws, 'message', {
    sender: 'system',
    content: t(lang, 'csat_thanks'),
    timestamp: new Date().toISOString(),
  });
}

// ─── Help Center: search knowledge base ───
async function handleSearchKB(ws, visitorId, msg) {
  if (!msg.query || typeof msg.query !== 'string' || msg.query.trim().length < 2) {
    send(ws, 'error', { message: 'Query too short' });
    return;
  }
  const session = (await sessionStore.get(visitorId)) || {};
  const results = await searchKnowledge(msg.query.trim(), msg.businessLine || null, session.language || 'es');
  send(ws, 'kb_results', {
    query: msg.query.trim(),
    results: results.slice(0, 8).map((r) => ({
      id: r.id,
      title: r.title,
      content: (r.content || '').slice(0, 300),
      category: r.category,
      businessLine: r.business_line,
    })),
  });
}

// ─── Quick Reply postback: handle special actions from rich messages ───
async function handleQuickReply(ws, visitorId, msg) {
  if (!msg.value) return;
  if (msg.value === '__escalate__') return handleEscalate(ws, visitorId);
  if (msg.value === '__lead_form__') {
    send(ws, 'show_lead_form', {});
    return;
  }
  if (msg.value === '__call__') return handleRequestCall(ws, visitorId);
  // Otherwise treat as a regular chat message
  return handleChat(ws, visitorId, { content: msg.value });
}

// Helper: send message to visitor from agent/system
async function sendToVisitor(visitorId, sender, content) {
  const ws = visitors.get(visitorId);
  if (ws) {
    send(ws, 'message', { sender, content, timestamp: new Date().toISOString() });
  }
}

module.exports = { initChatHandler, sendToVisitor, buildRichReply };
