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

const { evaluateTriggers } = require('../services/proactive-triggers');
const { notifyEscalation, notifyCallRequest, sendConversationSummary } = require('../services/email');
const { recordBotResponse, processCSATForLearning } = require('../services/learning');

// Map of visitorId -> ws
const visitors = new Map();

// ── WebSocket rate limiting ──
const wsRateLimits = new Map();
const WS_RATE = { maxMessages: 20, windowMs: 10000 };

function checkWsRateLimit(visitorId) {
  const now = Date.now();
  let bucket = wsRateLimits.get(visitorId);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WS_RATE.windowMs };
    wsRateLimits.set(visitorId, bucket);
  }
  bucket.count++;
  return bucket.count <= WS_RATE.maxMessages;
}

// Cleanup stale rate limit buckets every 60s
const wsCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, b] of wsRateLimits) {
    if (now > b.resetAt) wsRateLimits.delete(id);
  }
}, 60000);
wsCleanupInterval.unref(); // Don't prevent process exit

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
      // Rate limit WebSocket messages
      if (!checkWsRateLimit(visitorId)) {
        send(ws, 'error', { message: 'Too many messages. Please slow down.' });
        return;
      }
      try {
        const msg = JSON.parse(raw);
        // Sanitize string content: max 2000 chars, strip control characters and HTML tags
        if (typeof msg.content === 'string') {
          msg.content = msg.content
            .slice(0, 2000)
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
            .replace(/<[^>]*>/g, ''); // Strip HTML tags to prevent stored XSS
        }
        await handleMessage(ws, visitorId, msg);
      } catch (e) {
        logger.error(`Chat WS error (${visitorId}):`, e);
        send(ws, 'error', { message: 'Error processing message' });
      }
    });

    ws.on('close', () => {
      visitors.delete(visitorId);
      wsRateLimits.delete(visitorId);
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

  // Listen for agent typing indicator
  redis.subscribe('agent:typing', (data) => {
    const ws = visitors.get(data.visitorId);
    if (ws) {
      send(ws, 'agent_typing', {
        isTyping: data.isTyping,
        agentName: data.agentName,
        conversationId: data.conversationId,
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
    case 'request_call': return handleRequestCall(ws, visitorId, msg);
    case 'request_webrtc_call': return handleRequestWebRTCCall(ws, visitorId, msg);
    case 'webrtc_hangup': return handleWebRTCHangup(ws, visitorId, msg);
    case 'csat': return handleCsat(ws, visitorId, msg);
    case 'page_context': return handlePageContext(ws, visitorId, msg);
    case 'search_kb': return handleSearchKB(ws, visitorId, msg);
    case 'quick_reply': return handleQuickReply(ws, visitorId, msg);
    case 'visitor_typing': return handleVisitorTyping(ws, visitorId, msg);
    case 'request_transcript': return handleRequestTranscript(ws, visitorId);
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

  // Evaluate proactive triggers based on page context
  const triggerContext = {
    ...pageContext,
    timeOnPage: msg.timeOnPage || 0,
    scrollDepth: msg.scrollDepth || 0,
    exitIntent: msg.exitIntent || false,
    visitCount: msg.visitCount || 1,
    cartValue: msg.cartValue || 0,
    formInteraction: msg.formInteraction || false,
    idleTime: msg.idleTime || 0,
    language: (await sessionStore.get(visitorId))?.language || 'es',
  };
  checkProactiveTriggers(ws, visitorId, triggerContext);
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
    businessLine: conv.business_line || null,
    conversationHistory: history,
  });

  // Update business line if newly detected
  if (detectedLine && detectedLine !== conv.business_line) {
    await db.updateConversation(conv.id, { business_line: detectedLine });
  }

  // Build rich content when applicable
  const richContent = buildRichReply(msg.content, response, detectedLine || conv.business_line, language);

  // Save bot message + webhook
  const botMsg = await db.saveMessage({
    conversationId: conv.id, sender: 'bot', content: response,
    metadata: richContent ? { richContent } : {},
  });
  triggerWebhooks('message.sent', { conversationId: conv.id, sender: 'bot', content: response }).catch(() => {});

  // Record for learning/training review
  recordBotResponse({
    conversationId: conv.id, messageId: botMsg.id,
    visitorMessage: msg.content, aiResponse: response,
    provider: 'auto', businessLine: detectedLine || conv.business_line, language,
  }).catch(() => {});

  send(ws, 'typing', { isTyping: false });
  send(ws, 'message', {
    sender: 'bot',
    content: response,
    richContent,
    timestamp: new Date().toISOString(),
  });
}

const VALID_LANGUAGES = new Set(['es', 'en', 'pt', 'gl']);
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

  // Email notification (business hours only)
  if (isBusinessHours()) {
    notifyEscalation(conv.id, visitorId, conv.business_line, lang).catch((e) => logger.warn('Escalation email error:', e.message));
  }
}

async function handleRequestCall(ws, visitorId, msg) {
  const conv = await db.getActiveConversation(visitorId);
  if (!conv) return;

  const session = (await sessionStore.get(visitorId)) || {};
  const lang = session.language || 'es';

  // VoIP only during business hours
  if (!isBusinessHours()) {
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

  // Phone number is required for callback mode
  const phone = (msg && msg.phone || '').replace(/[^\d+]/g, '');
  if (!phone || phone.length < 6) {
    send(ws, 'call_error', { message: t(lang, 'phone_required') });
    return;
  }

  // Generate unique call ID
  const callId = uuid();

  // Save call record in database
  try {
    await db.query(
      `INSERT INTO calls (call_id, conversation_id, visitor_id, business_line, status, metadata, created_at)
       VALUES ($1, $2, $3, $4, 'ringing', $5, NOW())`,
      [callId, conv.id, visitorId, conv.business_line, JSON.stringify({ phone, mode: 'callback' })]
    );
  } catch (e) {
    logger.warn('Failed to create call record:', e.message);
  }

  await transition(conv.id, 'request_call');

  // Attempt SIP RDGPhone (Vozelia Cloud PBX)
  const { sipClient } = require('../services/sip-rdgphone');
  if (!sipClient.registered) {
    // SIP not available: save lead with phone for manual callback
    logger.warn('SIP not registered — saving phone for manual callback');
    send(ws, 'call_queued', {
      callId,
      message: t(lang, 'call_queued'),
    });

    // Notify agents via Redis so they can call back manually
    await redis.publish('call:incoming', {
      callId,
      conversationId: conv.id,
      visitorId,
      phone,
      language: lang,
      businessLine: conv.business_line,
      mode: 'manual_callback',
    });
  } else {
    // SIP registered: originate the call
    try {
      await sipClient.rdgphone(phone, conv.business_line);

      send(ws, 'call_initiated', {
        callId,
        message: t(lang, 'call_connecting'),
      });

      // Notify agents
      await redis.publish('call:incoming', {
        callId,
        conversationId: conv.id,
        visitorId,
        phone,
        language: lang,
        businessLine: conv.business_line,
        mode: 'sip_rdgphone',
      });
    } catch (e) {
      logger.error('SIP RDGPhone failed:', e.message);

      // Update call record as failed
      await db.query(`UPDATE calls SET status = 'failed' WHERE call_id = $1`, [callId]).catch(() => {});

      send(ws, 'call_error', {
        message: t(lang, 'call_error'),
      });
      return;
    }
  }

  triggerWebhooks('call.started', { callId, conversationId: conv.id, visitorId, phone, businessLine: conv.business_line }).catch(() => {});
  db.trackEvent({ eventType: 'call_requested', conversationId: conv.id, visitorId, data: { callId, phone } }).catch(() => {});

  // Email BU contacts about call request
  notifyCallRequest(conv.id, phone, conv.business_line).catch((e) => logger.warn('Call notification email error:', e.message));
}

// ─── WebRTC Call via Janus Gateway (browser-based call, no phone needed) ───
async function handleRequestWebRTCCall(ws, visitorId, _msg) {
  const conv = await db.getActiveConversation(visitorId);
  if (!conv) return;

  const session = (await sessionStore.get(visitorId)) || {};
  const lang = session.language || 'es';

  // VoIP only during business hours
  if (!isBusinessHours()) {
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

  const callId = uuid();

  // Save call record with webrtc mode
  try {
    await db.query(
      `INSERT INTO calls (call_id, conversation_id, visitor_id, business_line, status, metadata, created_at)
       VALUES ($1, $2, $3, $4, 'setup', $5, NOW())`,
      [callId, conv.id, visitorId, conv.business_line, JSON.stringify({ mode: 'webrtc' })]
    );
  } catch (e) {
    logger.warn('Failed to create webrtc call record:', e.message);
  }

  // Determine target extension based on business line
  const extensions = (process.env.CLICK2CALL_EXTENSIONS || '107').split(',');
  const targetExt = extensions[0]; // Primary agent extension

  // Send Janus connection details to widget
  const janusWsUrl = process.env.JANUS_PUBLIC_WS || `ws://${process.env.SERVER_PUBLIC_IP || 'localhost'}:8188`;
  const sipProxy = process.env.SIP_DOMAIN || 'cloudpbx1584.vozelia.com';
  const sipUser = process.env.SIP_EXTENSION || '108';
  const sipPassword = process.env.SIP_PASSWORD || '';
  const targetUri = `sip:${targetExt}@${sipProxy}`;

  send(ws, 'webrtc_ready', {
    callId,
    janusWsUrl,
    sipProxy,
    sipUser,
    sipPassword,
    targetUri,
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  });

  // Notify agents via Redis
  await redis.publish('call:incoming', {
    callId,
    conversationId: conv.id,
    visitorId,
    language: lang,
    businessLine: conv.business_line,
    mode: 'webrtc',
    targetExtension: targetExt,
  });

  // Log recording start
  const { logCallStart } = require('../services/call-recording');
  logCallStart({
    callId,
    conversationId: conv.id,
    visitorPhone: 'webrtc',
    agentExtension: targetExt,
    businessLine: conv.business_line,
  }).catch(() => {});

  triggerWebhooks('call.started', { callId, conversationId: conv.id, visitorId, mode: 'webrtc', businessLine: conv.business_line }).catch(() => {});
  db.trackEvent({ eventType: 'webrtc_call_requested', conversationId: conv.id, visitorId, data: { callId } }).catch(() => {});

  logger.info(`WebRTC call initiated: callId=${callId}, visitor=${visitorId}, target=${targetUri}`);
}

// ─── WebRTC Hangup: visitor or agent ends the Janus-based call ───
async function handleWebRTCHangup(ws, visitorId, msg) {
  const callId = msg.callId;
  if (!callId) return;

  const { logCallEnd } = require('../services/call-recording');
  const duration = typeof msg.duration === 'number' ? msg.duration : 0;

  // Update call status
  await db.query(`UPDATE calls SET status = 'ended' WHERE call_id = $1`, [callId]).catch(() => {});
  await logCallEnd({ callId, duration, status: 'ended' }).catch(() => {});

  triggerWebhooks('call.ended', { callId, visitorId, duration, mode: 'webrtc' }).catch(() => {});
  db.trackEvent({ eventType: 'webrtc_call_ended', visitorId, data: { callId, duration } }).catch(() => {});

  logger.info(`WebRTC call ended: callId=${callId}, duration=${duration}s`);
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

  // Auto-learn from high CSAT conversations
  if (conv?.id) {
    processCSATForLearning(conv.id, msg.rating).catch(() => {});
  }

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
  if (msg.value === '__call__') { send(ws, 'show_phone_form', {}); return; }
  // Otherwise treat as a regular chat message
  return handleChat(ws, visitorId, { content: msg.value });
}

// ─── Visitor typing: relay to agent via Redis ───
async function handleVisitorTyping(ws, visitorId, msg) {
  const conv = await db.getActiveConversation(visitorId);
  if (!conv?.agent_id) return;
  await redis.publish('visitor:typing', {
    conversationId: conv.id,
    visitorId,
    isTyping: !!msg.isTyping,
  });
}

// ─── Transcript export: send chat history to visitor ───
async function handleRequestTranscript(ws, visitorId) {
  const conv = await db.getActiveConversation(visitorId);
  if (!conv) {
    send(ws, 'error', { message: 'No active conversation' });
    return;
  }
  const { generateTranscript } = require('../services/transcript-export');
  const transcript = await generateTranscript(conv.id);
  send(ws, 'transcript', { text: transcript.text, html: transcript.html });
}

// ─── Proactive messaging: check triggers after page context update ───
async function checkProactiveTriggers(ws, visitorId, context) {
  try {
    const conv = await db.getActiveConversation(visitorId);
    if (conv) return; // Don't interrupt active conversations

    const trigger = await evaluateTriggers(visitorId, context);
    if (trigger) {
      send(ws, 'proactive_message', {
        trigger: trigger.trigger,
        content: trigger.message,
        timestamp: new Date().toISOString(),
      });
      db.trackEvent({ eventType: 'proactive_trigger', visitorId, data: { trigger: trigger.trigger } }).catch(() => {});
    }
  } catch (e) {
    logger.warn('Proactive trigger check failed:', e.message);
  }
}

// Helper: send message to visitor from agent/system
async function sendToVisitor(visitorId, sender, content) {
  const ws = visitors.get(visitorId);
  if (ws) {
    send(ws, 'message', { sender, content, timestamp: new Date().toISOString() });
  }
}

module.exports = { initChatHandler, sendToVisitor, buildRichReply };
