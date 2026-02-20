/**
 * Callbacks API Routes — Premium callback scheduling endpoints.
 *
 * ─── REGISTRATION ──────────────────────────────────────────────────────────
 * Add this line to server/index.js in the REST Routes section:
 *
 *   app.use('/api/callbacks', require('./routes/callbacks'));
 *
 * Place it alongside the other route registrations, e.g.:
 *
 *   app.use('/api/calls', require('./routes/call'));
 *   app.use('/api/callbacks', require('./routes/callbacks'));  // <-- add this
 *   app.use('/api/analytics', require('./routes/analytics'));
 * ─── END REGISTRATION ──────────────────────────────────────────────────────
 */

const { Router } = require('express');
const { requireAgent } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/error-handler');
const { logger } = require('../utils/logger');
const {
  scheduleCallback,
  getAvailableSlots,
  getPendingCallbacks,
  updateCallbackStatus,
} = require('../services/callback-scheduler');

const router = Router();

// ═════════════════════════════════════════════════════════════════════════════
// WIDGET-FACING (no auth — called from the widget)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/callbacks/schedule
 * Schedule a new callback from the widget.
 *
 * Body: { phone, name?, date, timeSlot, timeRange, businessLine?, visitorId, language?, conversationId?, note? }
 * Response: { callbackId, scheduledFor }
 */
router.post('/schedule', asyncRoute(async (req, res) => {
  const {
    phone, name, date, timeSlot, timeRange,
    businessLine, visitorId, language, conversationId, note,
  } = req.body;

  if (!phone || !date || !timeSlot || !visitorId) {
    return res.status(400).json({ error: 'Missing required fields: phone, date, timeSlot, visitorId' });
  }

  try {
    const result = await scheduleCallback({
      phone,
      name,
      date,
      timeSlot,
      timeRange: timeRange || '',
      businessLine,
      visitorId,
      conversationId,
      language: language || 'es',
      note,
    });

    res.json(result);
  } catch (e) {
    const status = e.status || 500;
    logger.warn(`Callback schedule error: ${e.message}`);
    res.status(status).json({ error: e.message });
  }
}));

/**
 * GET /api/callbacks/slots/:date
 * Get available time slots for a specific date.
 * Optional query param: ?businessLine=boostic
 *
 * Response: { slots: [{ slot, timeRange, available, agentCount }] }
 */
router.get('/slots/:date', asyncRoute(async (req, res) => {
  const { date } = req.params;
  const { businessLine } = req.query;

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  const slots = await getAvailableSlots(date, businessLine || undefined);
  res.json({ slots });
}));

// ═════════════════════════════════════════════════════════════════════════════
// AGENT / ADMIN (require auth)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/callbacks
 * List callbacks with optional filters.
 * Query params: ?businessLine=&date=&status=&limit=&offset=
 *
 * Response: Array of callback objects
 */
router.get('/', requireAgent, asyncRoute(async (req, res) => {
  const { businessLine, date, status, limit, offset } = req.query;

  const callbacks = await getPendingCallbacks({
    businessLine: businessLine || undefined,
    date: date || undefined,
    status: status || undefined,
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
  });

  res.json(callbacks);
}));

/**
 * PUT /api/callbacks/:id/status
 * Update callback status (agent marks as completed, missed, cancelled, etc.)
 *
 * Body: { status: 'completed'|'confirmed'|'missed'|'cancelled' }
 * Response: Updated callback object
 */
router.put('/:id/status', requireAgent, asyncRoute(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Missing status field' });
  }

  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({ error: 'Invalid callback ID' });
  }

  try {
    const callback = await updateCallbackStatus(id, status, req.agent.id);
    res.json(callback);
  } catch (e) {
    const httpStatus = e.status || 500;
    res.status(httpStatus).json({ error: e.message });
  }
}));

module.exports = router;
