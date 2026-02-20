/**
 * Settings API — Admin panel + Setup wizard
 *
 * GET  /api/settings           → All settings (admin only)
 * PUT  /api/settings           → Update settings (admin only)
 * GET  /api/settings/setup     → Check if setup is needed
 * POST /api/settings/setup     → Complete initial setup (no auth if first time)
 * POST /api/settings/test-smtp → Test SMTP connection
 * POST /api/settings/test-ami  → Test AMI connection
 */

const { Router } = require('express');
const { requireAgent } = require('../middleware/auth');
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

  const { smtp, ami, click2call, buExtensions, notificationEmail, ai, hours, brand } = req.body;

  const toSave = {};

  // SMTP
  if (smtp) {
    if (smtp.host) toSave['smtp.host'] = smtp.host;
    if (smtp.port) toSave['smtp.port'] = String(smtp.port);
    if (smtp.user) toSave['smtp.user'] = smtp.user;
    if (smtp.password) toSave['smtp.password'] = smtp.password;
    if (smtp.from) toSave['smtp.from'] = smtp.from;
  }

  // AMI
  if (ami) {
    if (ami.host) toSave['ami.host'] = ami.host;
    if (ami.port) toSave['ami.port'] = String(ami.port);
    if (ami.user) toSave['ami.user'] = ami.user;
    if (ami.password) toSave['ami.password'] = ami.password;
  }

  // Click2Call
  if (click2call) {
    if (click2call.extension) toSave['click2call.extension'] = click2call.extension;
    if (click2call.context) toSave['click2call.context'] = click2call.context;
    if (click2call.trunk) toSave['click2call.trunk'] = click2call.trunk;
  }

  // BU Extensions
  if (buExtensions) {
    if (buExtensions.boostic) toSave['bu.ext.boostic'] = buExtensions.boostic;
    if (buExtensions.binnacle) toSave['bu.ext.binnacle'] = buExtensions.binnacle;
    if (buExtensions.marketing) toSave['bu.ext.marketing'] = buExtensions.marketing;
    if (buExtensions.tech) toSave['bu.ext.tech'] = buExtensions.tech;
    if (buExtensions.default) toSave['bu.ext.default'] = buExtensions.default;
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

// ─── Test SMTP connection ───
router.post('/test-smtp', async (req, res) => {
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

// ─── Test AMI connection ───
router.post('/test-ami', async (req, res) => {
  const { host, port, user, password } = req.body;
  if (!host || !user || !password) {
    return res.status(400).json({ error: 'host, user, password required' });
  }
  try {
    const net = require('net');
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { socket.destroy(); reject(new Error('Connection timeout')); }, 5000);
      const socket = net.createConnection({ host, port: parseInt(port || '5038', 10) }, () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve(true);
      });
      socket.on('error', (e) => { clearTimeout(timeout); reject(e); });
    });
    res.json({ success: true, message: 'AMI connection OK' });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

module.exports = router;
