const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db } = require('../utils/db');
const { requireApiKey, requireAgent } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/error-handler');
const { generateSipCredentials } = require('../services/sip-manager');
const { getQueueName } = require('../services/queue-manager');
const { isBusinessHours } = require('../services/router');
const {
  getCallRecordings, getCallDetail, getCallStats,
  saveRecording, transcribeCall,
  startMonitoring, stopMonitoring,
  cleanupOldRecordings, RECORDINGS_DIR,
} = require('../services/call-recording');
const { sipClient } = require('../services/sip-click2call');

const router = Router();

// Multer for recording uploads (from PBX webhook)
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

// ─── Widget: Request SIP credentials ───
router.post('/credentials', requireApiKey, async (req, res) => {
  const { visitorId, conversationId } = req.body;
  if (!visitorId) return res.status(400).json({ error: 'visitorId required' });

  const creds = generateSipCredentials(visitorId);

  let queue = 'queue-general';
  if (conversationId) {
    const conv = await db.getConversation(conversationId);
    if (conv?.business_line) queue = getQueueName(conv.business_line);
  }

  const call = await db.createCall({
    conversationId,
    agentId: null,
    queue,
    visitorSipId: creds.extension,
  });

  res.json({ callId: call.id, sip: creds, queue });
});

// ─── Widget: End call ───
router.post('/:id/end', requireApiKey, async (req, res) => {
  const { duration } = req.body;
  await db.updateCall(req.params.id, {
    status: 'ended',
    ended_at: new Date().toISOString(),
    ...(duration ? { duration_seconds: duration } : {}),
  });
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════
// ADMIN / AGENT ROUTES (require auth)
// ═══════════════════════════════════════════════════════════════

// ─── Call stats ───
router.get('/stats', requireAgent, asyncRoute(async (_req, res) => {
  const stats = await getCallStats();
  res.json(stats);
}));

// ─── List calls with recordings ───
router.get('/recordings', requireAgent, asyncRoute(async (req, res) => {
  const { businessLine, status, limit, offset } = req.query;
  const calls = await getCallRecordings({
    businessLine: businessLine || undefined,
    status: status || undefined,
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
  });
  res.json(calls);
}));

// ─── Get call detail (with transcript) ───
router.get('/recordings/:callId', requireAgent, asyncRoute(async (req, res) => {
  const call = await getCallDetail(req.params.callId);
  if (!call) return res.status(404).json({ error: 'Call not found' });
  res.json(call);
}));

// ─── Serve recording audio file ───
router.get('/recordings/file/:filename', requireAgent, (req, res) => {
  const filename = path.basename(req.params.filename); // Prevent path traversal
  const filePath = path.join(RECORDINGS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Recording file not found' });
  }
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = { '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
  res.setHeader('Content-Type', mimeTypes[ext] || 'audio/wav');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  fs.createReadStream(filePath).pipe(res);
});

// ─── Upload recording (webhook from PBX) ───
router.post('/recordings/:callId/upload', upload.single('recording'), asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No recording file uploaded' });
  const url = await saveRecording(req.params.callId, req.file.buffer, req.file.mimetype);
  res.json({ url });
}));

// ─── Transcribe a call ───
router.post('/recordings/:callId/transcribe', requireAgent, asyncRoute(async (req, res) => {
  const transcript = await transcribeCall(req.params.callId);
  res.json({ transcript });
}));

// ─── Admin: Start monitoring a live call ───
router.post('/recordings/:callId/monitor', requireAgent, asyncRoute(async (req, res) => {
  const call = await getCallDetail(req.params.callId);
  if (!call) return res.status(404).json({ error: 'Call not found' });
  if (call.status !== 'active') return res.status(400).json({ error: 'Call is not active' });

  // Check admin/supervisor role
  if (!['admin', 'supervisor'].includes(req.agent.role)) {
    return res.status(403).json({ error: 'Only admins and supervisors can monitor calls' });
  }

  // SIP spy: INVITE to the call with spy prefix
  // Vozelia typically supports *XX for ChanSpy (e.g., *1 + extension)
  try {
    const spyExt = call.agent_extension;
    if (!spyExt) throw new Error('No agent extension for this call');

    // Use SIP INVITE to spy channel (*1 prefix = listen-only on most PBX)
    const { domain, extension } = sipClient.config;
    if (!sipClient.registered) throw new Error('SIP not registered');

    const spyUri = `sip:*1${spyExt}@${domain}`;
    // Log the monitoring
    await startMonitoring(req.params.callId, req.agent.id);

    // Return SIP URI for the admin to connect to
    res.json({
      success: true,
      message: `Monitoring call to ext ${spyExt}`,
      sipUri: spyUri,
      callId: req.params.callId,
      agentExtension: spyExt,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}));

// ─── Admin: Stop monitoring ───
router.post('/recordings/:callId/monitor/stop', requireAgent, asyncRoute(async (req, res) => {
  await stopMonitoring(req.params.callId);
  res.json({ success: true });
}));

// ─── Admin: Manual cleanup ───
router.post('/cleanup', requireAgent, asyncRoute(async (req, res) => {
  if (req.agent.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can trigger cleanup' });
  }
  const result = await cleanupOldRecordings();
  res.json(result);
}));

module.exports = router;
