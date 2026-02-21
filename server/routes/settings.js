/**
 * Settings API — Admin panel + Setup wizard
 *
 * GET  /api/settings           → All settings (admin only)
 * PUT  /api/settings           → Update settings (admin only)
 * GET  /api/settings/setup     → Check if setup is needed
 * POST /api/settings/setup     → Complete initial setup (no auth if first time)
 * POST /api/settings/test-smtp → Test SMTP connection
 * POST /api/settings/test-sip  → Test SIP connectivity (UDP)
 */

const { Router } = require('express');
const { requireAgent, requireRole } = require('../middleware/auth');
const settings = require('../services/settings');
const { logger } = require('../utils/logger');

const router = Router();

// ─── Check if setup is needed (public) ───
router.get('/setup', async (_req, res) => {
  const done = await settings.isSetupComplete();
  res.json({ setupRequired: !done });
});

// ─── Initial setup (no auth if first time) ───
router.post('/setup', async (req, res) => {
  const done = await settings.isSetupComplete();
  if (done) {
    return res.status(403).json({ error: 'Setup already completed. Use the admin panel to change settings.' });
  }

  const { smtp, sip, rdgphone, notificationEmail, ai, hours, brand } = req.body;

  const toSave = {};

  // SMTP
  if (smtp) {
    if (smtp.host) toSave['smtp.host'] = smtp.host;
    if (smtp.port) toSave['smtp.port'] = String(smtp.port);
    if (smtp.user) toSave['smtp.user'] = smtp.user;
    if (smtp.password) toSave['smtp.password'] = smtp.password;
    if (smtp.from) toSave['smtp.from'] = smtp.from;
  }

  // SIP (Vozelia Cloud PBX)
  if (sip) {
    if (sip.domain) toSave['sip.domain'] = sip.domain;
    if (sip.port) toSave['sip.port'] = String(sip.port);
    if (sip.extension) toSave['sip.extension'] = sip.extension;
    if (sip.password) toSave['sip.password'] = sip.password;
  }

  // RDGPhone
  if (rdgphone) {
    if (rdgphone.extensions) toSave['rdgphone.extensions'] = rdgphone.extensions;
    if (rdgphone.callerIdName) toSave['rdgphone.callerid_name'] = rdgphone.callerIdName;
  }

  // Notification email
  if (notificationEmail) toSave['notification.email'] = notificationEmail;

  // AI
  if (ai) {
    if (ai.provider) toSave['ai.provider'] = ai.provider;
  }

  // Business hours
  if (hours) {
    if (hours.timezone) toSave['hours.timezone'] = hours.timezone;
    if (hours.start) toSave['hours.start'] = String(hours.start);
    if (hours.end) toSave['hours.end'] = String(hours.end);
  }

  // Branding
  if (brand) {
    if (brand.primaryColor) toSave['brand.primary_color'] = brand.primaryColor;
    if (brand.companyName) toSave['brand.company_name'] = brand.companyName;
  }

  toSave['setup.completed'] = 'true';

  const ok = await settings.setMany(toSave);
  if (!ok) {
    return res.status(500).json({ error: 'Failed to save settings' });
  }

  logger.info('Setup: Initial configuration completed');
  res.json({ success: true, message: 'Setup completed successfully' });
});

// ─── Get all settings (admin) ───
router.get('/', requireAgent, async (req, res) => {
  if (req.agent.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const all = await settings.getAllForAdmin();
  res.json(all);
});

// ─── Update settings (admin) ───
router.put('/', requireAgent, async (req, res) => {
  if (req.agent.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { settings: newSettings } = req.body;
  if (!newSettings || typeof newSettings !== 'object') {
    return res.status(400).json({ error: 'settings object required' });
  }

  // Validate keys — only allow known setting keys
  const validKeys = new Set(Object.keys(settings.DEFAULTS));
  const filtered = {};
  for (const [key, value] of Object.entries(newSettings)) {
    if (validKeys.has(key) && typeof value === 'string') {
      filtered[key] = value;
    }
  }

  const ok = await settings.setMany(filtered);
  if (!ok) {
    return res.status(500).json({ error: 'Failed to save settings' });
  }

  logger.info(`Settings: Updated ${Object.keys(filtered).length} settings by ${req.agent.username}`);
  res.json({ success: true, updated: Object.keys(filtered) });
});

// ─── Test SMTP connection (admin only) ───
router.post('/test-smtp', requireAgent, requireRole('admin'), async (req, res) => {
  const { host, port, user, password } = req.body;
  if (!host || !user || !password) {
    return res.status(400).json({ error: 'host, user, password required' });
  }
  try {
    const nodemailer = require('nodemailer');
    const transport = nodemailer.createTransport({
      host,
      port: parseInt(port || '587', 10),
      secure: parseInt(port || '587', 10) === 465,
      auth: { user, pass: password },
      connectionTimeout: 5000,
    });
    await transport.verify();
    transport.close();
    res.json({ success: true, message: 'SMTP connection OK' });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

// ─── Test SIP connectivity (UDP OPTIONS ping, admin only) ───
router.post('/test-sip', requireAgent, requireRole('admin'), async (req, res) => {
  const { domain, port, extension, password } = req.body;
  if (!domain || !extension) {
    return res.status(400).json({ error: 'domain and extension required' });
  }
  try {
    const dgram = require('dgram');
    const crypto = require('crypto');
    const sipPort = parseInt(port || '5060', 10);
    const branch = 'z9hG4bK' + crypto.randomBytes(6).toString('hex');
    const callId = crypto.randomBytes(8).toString('hex');
    const tag = crypto.randomBytes(4).toString('hex');

    const result = await new Promise((resolve, reject) => {
      const socket = dgram.createSocket('udp4');
      const timeout = setTimeout(() => { socket.close(); reject(new Error('SIP timeout — no response from server')); }, 5000);

      socket.bind(0, () => {
        const localPort = socket.address().port;
        const localIp = '0.0.0.0';
        const msg = [
          `OPTIONS sip:${domain} SIP/2.0`,
          `Via: SIP/2.0/UDP ${localIp}:${localPort};branch=${branch};rport`,
          `From: <sip:${extension}@${domain}>;tag=${tag}`,
          `To: <sip:${domain}>`,
          `Call-ID: ${callId}`,
          `CSeq: 1 OPTIONS`,
          `Max-Forwards: 70`,
          `User-Agent: RdgBot/1.0`,
          `Content-Length: 0`,
          ``,
          ``,
        ].join('\r\n');

        socket.on('message', (buf) => {
          clearTimeout(timeout);
          const str = buf.toString();
          const match = str.match(/^SIP\/2\.0\s+(\d+)/);
          socket.close();
          if (match) {
            const code = parseInt(match[1]);
            if (code < 400) resolve(`SIP OK — ${code}`);
            else resolve(`SIP response ${code}`);
          } else {
            resolve('SIP response received');
          }
        });

        const buf = Buffer.from(msg);
        socket.send(buf, 0, buf.length, sipPort, domain);
      });

      socket.on('error', (e) => { clearTimeout(timeout); socket.close(); reject(e); });
    });
    res.json({ success: true, message: result });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

module.exports = router;
