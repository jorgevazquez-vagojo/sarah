const { Router } = require('express');
const { db } = require('../utils/db');
const { requireApiKey } = require('../middleware/auth');
const { generateSipCredentials } = require('../services/sip-manager');
const { getQueueName } = require('../services/queue-manager');
const { isBusinessHours } = require('../services/router');

const router = Router();

// Request SIP credentials for WebRTC call (widget)
router.post('/credentials', requireApiKey, async (req, res) => {
  if (!isBusinessHours()) {
    return res.status(403).json({ error: 'Calls only available during business hours' });
  }

  const { visitorId, conversationId } = req.body;
  if (!visitorId) return res.status(400).json({ error: 'visitorId required' });

  const creds = generateSipCredentials(visitorId);

  // Determine queue from conversation
  let queue = 'queue-general';
  if (conversationId) {
    const conv = await db.getConversation(conversationId);
    if (conv?.business_line) {
      queue = getQueueName(conv.business_line);
    }
  }

  // Create call record
  const call = await db.createCall({
    conversationId,
    agentId: null,
    queue,
    visitorSipId: creds.extension,
  });

  res.json({
    callId: call.id,
    sip: creds,
    queue,
  });
});

// End call
router.post('/:id/end', requireApiKey, async (req, res) => {
  const { duration } = req.body;
  await db.updateCall(req.params.id, {
    status: 'ended',
    ended_at: new Date().toISOString(),
    ...(duration ? { duration_seconds: duration } : {}),
  });
  res.json({ ok: true });
});

module.exports = router;
