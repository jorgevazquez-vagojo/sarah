/**
 * AI Caller REST API Routes
 *
 * Endpoints for managing bidirectional AI sales/support calls:
 * - Start single or batch calls
 * - Monitor active calls
 * - Hangup calls
 * - View call history
 */
const { Router } = require('express');
const { requireAgent, requireRole } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/error-handler');
const { aiCallerManager } = require('../services/ai-caller');

const router = Router();

// ─── Initialize manager on first request ───
let initialized = false;
router.use(async (req, res, next) => {
  if (!initialized) {
    try {
      await aiCallerManager.init();
      initialized = true;
    } catch (e) {
      return res.status(500).json({ error: 'AI Caller not configured: ' + e.message });
    }
  }
  next();
});

// ─── POST /call — Start a single AI call ───
router.post('/call', requireAgent, requireRole('admin', 'agent'), asyncRoute(async (req, res) => {
  const { targetNumber, targetName, callerIdName, greeting, systemPrompt, maxTurns, businessLine } = req.body;
  if (!targetNumber) return res.status(400).json({ error: 'targetNumber required' });
  if (!greeting) return res.status(400).json({ error: 'greeting required' });

  const call = await aiCallerManager.startCall({
    targetNumber,
    targetName: targetName || `Prospecto ${targetNumber}`,
    callerIdName: callerIdName || 'Redegal Comercial',
    greeting,
    systemPrompt: systemPrompt || defaultSystemPrompt(callerIdName),
    maxTurns: maxTurns || 8,
    businessLine: businessLine || 'general',
  });

  res.json({
    success: true,
    callId: call.id,
    targetNumber,
    targetName: call.config.targetName,
    state: call.state,
  });
}));

// ─── POST /batch — Start multiple AI calls ───
router.post('/batch', requireAgent, requireRole('admin'), asyncRoute(async (req, res) => {
  const { calls } = req.body;
  if (!Array.isArray(calls) || calls.length === 0) {
    return res.status(400).json({ error: 'calls array required (min 1)' });
  }
  if (calls.length > 20) {
    return res.status(400).json({ error: 'Maximum 20 calls per batch' });
  }

  const configs = calls.map((c) => ({
    targetNumber: c.targetNumber,
    targetName: c.targetName || `Prospecto ${c.targetNumber}`,
    callerIdName: c.callerIdName || 'Redegal Comercial',
    greeting: c.greeting,
    systemPrompt: c.systemPrompt || defaultSystemPrompt(c.callerIdName),
    maxTurns: c.maxTurns || 8,
    businessLine: c.businessLine || 'general',
  }));

  const started = await aiCallerManager.startBatch(configs);
  res.json({
    success: true,
    started: started.length,
    calls: started.map((c) => ({ id: c.id, targetNumber: c.config.targetNumber, state: c.state })),
  });
}));

// ─── GET /status — All active calls status ───
router.get('/status', requireAgent, asyncRoute(async (req, res) => {
  res.json(aiCallerManager.getStatus());
}));

// ─── GET /call/:id — Single call detail ───
router.get('/call/:id', requireAgent, asyncRoute(async (req, res) => {
  const call = aiCallerManager.activeCalls.get(req.params.id);
  if (call) {
    return res.json({
      id: call.id,
      state: call.state,
      targetNumber: call.config.targetNumber,
      targetName: call.config.targetName,
      turns: call.history.length,
      history: call.history,
      startTime: call.startTime,
    });
  }

  // Check completed calls
  const completed = aiCallerManager.completedCalls.find((c) => c.id === req.params.id);
  if (completed) return res.json(completed);

  res.status(404).json({ error: 'Call not found' });
}));

// ─── POST /hangup/:id — Hangup specific call ───
router.post('/hangup/:id', requireAgent, asyncRoute(async (req, res) => {
  try {
    aiCallerManager.hangup(req.params.id);
    res.json({ success: true, callId: req.params.id });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
}));

// ─── POST /hangup-all — Hangup all active calls ───
router.post('/hangup-all', requireAgent, requireRole('admin', 'agent'), asyncRoute(async (req, res) => {
  aiCallerManager.hangupAll();
  res.json({ success: true, message: 'All calls hung up' });
}));

// ─── GET /history — Completed calls ───
router.get('/history', requireAgent, asyncRoute(async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const history = aiCallerManager.getCallHistory().slice(-limit);
  res.json({ total: aiCallerManager.completedCalls.length, calls: history });
}));

// ─── POST /inbound/start — Start inbound SIP listener ───
router.post('/inbound/start', requireAgent, requireRole('admin'), asyncRoute(async (req, res) => {
  await aiCallerManager.startInboundListener();
  res.json({ success: true, message: 'Inbound listener started on port 5060' });
}));

// ─── POST /inbound/stop — Stop inbound SIP listener ───
router.post('/inbound/stop', requireAgent, requireRole('admin'), asyncRoute(async (req, res) => {
  aiCallerManager.stopInboundListener();
  res.json({ success: true, message: 'Inbound listener stopped' });
}));

// ─── POST /schedule — Create Google Calendar event from call ───
router.post('/schedule', requireAgent, asyncRoute(async (req, res) => {
  const { callId, title, date, time, duration, attendeeEmail, description } = req.body;
  if (!title || !date || !time) return res.status(400).json({ error: 'title, date, time required' });

  // Google Calendar API (requires GOOGLE_CALENDAR_CREDENTIALS)
  const calendarEvent = {
    summary: title,
    description: description || `Reunión agendada desde llamada AI ${callId || ''}`,
    start: {
      dateTime: `${date}T${time}:00`,
      timeZone: 'Europe/Madrid',
    },
    end: {
      dateTime: `${date}T${addMinutes(time, duration || 30)}:00`,
      timeZone: 'Europe/Madrid',
    },
    attendees: attendeeEmail ? [{ email: attendeeEmail }] : [],
    reminders: { useDefault: true },
  };

  try {
    const event = await createCalendarEvent(calendarEvent);
    res.json({ success: true, event });
  } catch (e) {
    res.status(500).json({ error: `Calendar: ${e.message}` });
  }
}));

// ─── Default system prompt factory ───
function defaultSystemPrompt(callerName = 'Redegal Comercial') {
  return `Eres ${callerName}, un representante comercial profesional de Redegal, empresa líder en soluciones digitales.

REGLAS:
- Habla en español, con tono profesional pero cercano
- Frases cortas y naturales, máximo 2-3 oraciones por turno
- No uses markdown, asteriscos ni formato especial
- Si el cliente no tiene interés, agradece amablemente y despídete
- Si muestra interés, ofrece agendar una reunión o videollamada
- Nunca inventes datos técnicos concretos (precios, plazos)
- Adapta tu tono al del cliente (más formal si es formal, más coloquial si es coloquial)

SERVICIOS DE REDEGAL:
- Boostic: SEO, SEM, Growth Marketing
- Binnacle: Business Intelligence, Analytics
- Digital Marketing: Estrategia digital, redes sociales
- Tech: Desarrollo web, ecommerce (Shopify Plus, Magento, custom)`;
}

// ─── Google Calendar helpers ───
function addMinutes(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

async function createCalendarEvent(event) {
  const { google } = require('googleapis');
  const credentialsJson = process.env.GOOGLE_CALENDAR_CREDENTIALS;
  if (!credentialsJson) throw new Error('GOOGLE_CALENDAR_CREDENTIALS not configured');

  const credentials = JSON.parse(credentialsJson);
  const auth = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ['https://www.googleapis.com/auth/calendar'],
  );
  await auth.authorize();

  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  const result = await calendar.events.insert({
    calendarId,
    resource: event,
    sendUpdates: 'all',
  });

  return {
    id: result.data.id,
    htmlLink: result.data.htmlLink,
    start: result.data.start,
    end: result.data.end,
    summary: result.data.summary,
  };
}

module.exports = router;
