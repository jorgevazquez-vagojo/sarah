const { Router } = require('express');
const { db } = require('../utils/db');
const { redis } = require('../utils/redis');
const { requireAgent, requireApiKey } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { logger } = require('../utils/logger');
const { updateTheme, createTenant, createCanned } = require('../schemas/config');
const { createWebhook } = require('../schemas/webhooks');

const router = Router();

const THEME_CACHE_TTL = 300; // 5 min

// ─── Public: Widget config (called by loader.js) ───
router.get('/widget', async (req, res) => {
  const { tenant } = req.query;
  const tenantSlug = tenant || 'redegal';

  try {
    const config = await redis.cached(`theme:${tenantSlug}`, THEME_CACHE_TTL, async () => {
      const t = await db.query(
        `SELECT wt.config FROM widget_themes wt
         JOIN tenants t ON t.id = wt.tenant_id
         WHERE t.slug = $1 AND wt.is_active = true
         LIMIT 1`,
        [tenantSlug]
      );
      return t.rows[0]?.config || getDefaultTheme();
    });

    res.json(config);
  } catch (e) {
    logger.warn('Config fetch error:', e.message);
    res.json(getDefaultTheme());
  }
});

// ─── Public: available languages ───
router.get('/languages', async (req, res) => {
  const { loadLanguages, getSupportedLanguages } = require('../utils/i18n');
  res.json({ languages: getSupportedLanguages() });
});

// ─── Public: language strings for a specific lang ───
router.get('/languages/:lang', async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const yaml = require('js-yaml');
  const lang = req.params.lang.replace(/[^a-z0-9\-]/gi, '');
  const filePath = path.join(__dirname, '..', 'config', 'languages', `${lang}.yaml`);
  try {
    const content = yaml.load(fs.readFileSync(filePath, 'utf8'));
    res.json(content);
  } catch {
    res.status(404).json({ error: 'Language not found' });
  }
});

// ─── Public: Copilot widget config (internal use, role-aware) ───
router.get('/copilot', (req, res) => {
  const role = req.query.role || 'admin';
  res.json(getCopilotTheme(role));
});

// ─── Admin: get full theme (tenant-isolated) ───
router.get('/theme', requireAgent, async (req, res) => {
  if (req.tenantId) {
    const themes = await db.query(
      `SELECT wt.*, t.slug as tenant_slug FROM widget_themes wt
       JOIN tenants t ON t.id = wt.tenant_id
       WHERE wt.tenant_id = $1
       ORDER BY wt.created_at`,
      [req.tenantId]
    );
    return res.json(themes.rows);
  }
  const themes = await db.query(
    `SELECT wt.*, t.slug as tenant_slug FROM widget_themes wt
     JOIN tenants t ON t.id = wt.tenant_id
     ORDER BY wt.created_at`
  );
  res.json(themes.rows);
});

// ─── Admin: update theme (validated, tenant-isolated) ───
router.put('/theme/:id', requireAgent, validate(updateTheme), async (req, res) => {
  const { config } = req.body;

  // Tenant isolation: ensure the theme belongs to the agent's tenant
  let query = `UPDATE widget_themes SET config = $1, updated_at = NOW() WHERE id = $2`;
  const params = [config, req.params.id];
  if (req.tenantId) {
    query += ` AND tenant_id = $3`;
    params.push(req.tenantId);
  }
  query += ` RETURNING *`;

  const result = await db.query(query, params);
  if (!result.rows[0]) return res.status(404).json({ error: 'Theme not found' });

  // Invalidate cache
  const tenant = await db.query(
    `SELECT t.slug FROM tenants t JOIN widget_themes wt ON wt.tenant_id = t.id WHERE wt.id = $1`,
    [req.params.id]
  );
  if (tenant.rows[0]) {
    await redis.del(`cache:theme:${tenant.rows[0].slug}`);
  }

  res.json(result.rows[0]);
});

// ─── Admin: create tenant (validated) ───
router.post('/tenants', requireAgent, validate(createTenant), async (req, res) => {
  const { slug, name, domain } = req.body;

  const result = await db.query(
    `INSERT INTO tenants (slug, name, domain) VALUES ($1, $2, $3) RETURNING *`,
    [slug, name, domain]
  );

  // Create default theme for new tenant
  await db.query(
    `INSERT INTO widget_themes (tenant_id, name, is_active, config) VALUES ($1, 'default', true, $2)`,
    [result.rows[0].id, JSON.stringify(getDefaultTheme())]
  );

  res.json(result.rows[0]);
});

// ─── Admin: manage canned responses (tenant-isolated) ───
router.get('/canned', requireAgent, async (req, res) => {
  const { language, businessLine } = req.query;
  const conds = ['1=1'];
  const vals = [];
  let i = 1;
  if (req.tenantId) { conds.push(`tenant_id = $${i++}`); vals.push(req.tenantId); }
  if (language) { conds.push(`language = $${i++}`); vals.push(language); }
  if (businessLine) { conds.push(`business_line = $${i++}`); vals.push(businessLine); }
  const result = await db.query(
    `SELECT * FROM canned_responses WHERE ${conds.join(' AND ')} ORDER BY usage_count DESC`,
    vals
  );
  res.json(result.rows);
});

router.post('/canned', requireAgent, validate(createCanned), async (req, res) => {
  const { shortcut, title, content, language, businessLine, category } = req.body;
  const result = await db.query(
    `INSERT INTO canned_responses (shortcut, title, content, language, business_line, category, created_by, tenant_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [shortcut, title, content, language || 'es', businessLine, category, req.agent.id, req.tenantId || null]
  );
  res.json(result.rows[0]);
});

router.delete('/canned/:id', requireAgent, async (req, res) => {
  if (req.tenantId) {
    await db.query('DELETE FROM canned_responses WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId]);
  } else {
    await db.query('DELETE FROM canned_responses WHERE id = $1', [req.params.id]);
  }
  res.json({ ok: true });
});

// ─── Admin: webhooks (validated, tenant-isolated) ───
router.get('/webhooks', requireAgent, async (req, res) => {
  if (req.tenantId) {
    const result = await db.query('SELECT * FROM webhooks WHERE tenant_id = $1 ORDER BY created_at', [req.tenantId]);
    return res.json(result.rows);
  }
  const result = await db.query('SELECT * FROM webhooks ORDER BY created_at');
  res.json(result.rows);
});

router.post('/webhooks', requireAgent, validate(createWebhook), async (req, res) => {
  const { url, events, secret } = req.body;
  const result = await db.query(
    `INSERT INTO webhooks (url, events, secret, tenant_id) VALUES ($1, $2, $3, $4) RETURNING *`,
    [url, events, secret, req.tenantId || null]
  );
  res.json(result.rows[0]);
});

function getDefaultTheme() {
  return {
    branding: {
      companyName: 'Redegal',
      logoUrl: '',
      faviconUrl: '',
      poweredByText: 'Powered by Redegal',
      showPoweredBy: true,
    },
    colors: {
      primary: '#007fff', primaryDark: '#0066cc', primaryLight: '#E0F0FF',
      secondary: '#32373c', accent: '#0693e3',
      background: '#FFFFFF', surface: '#F7F9FC',
      text: '#1A1A2E', textSecondary: '#5A6178', textOnPrimary: '#FFFFFF',
      border: '#E5E9F0', success: '#00D084', warning: '#FCB900', error: '#CF2E2E',
      gradientFrom: '#007fff', gradientTo: '#0055CC', headerGradient: true,
    },
    typography: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: 14, headerFontSize: 16, messagesFontSize: 14,
    },
    layout: {
      position: 'bottom-right', offsetX: 20, offsetY: 20,
      width: 400, maxHeight: 650, borderRadius: 16,
      buttonSize: 60, buttonBorderRadius: 30, headerHeight: 64,
      zIndex: 2147483647, mobileFullscreen: true,
    },
    features: {
      enableVoip: true, enableFileUpload: true, enableEmoji: true,
      enableCsat: true, enableLeadForm: true, enableQuickReplies: true,
      enableRichMessages: true, enableSoundNotifications: true,
      enableReadReceipts: true, enableTypingIndicator: true,
      enableLanguageSelector: true, enableBusinessLines: true,
      enableDarkMode: false, enableAttachments: true,
      maxFileSize: 10485760,
      allowedFileTypes: ['image/*', 'application/pdf', '.doc', '.docx', '.xls', '.xlsx'],
    },
    i18n: {
      defaultLanguage: 'es',
      availableLanguages: ['es', 'en', 'pt', 'gl'],
      autoDetect: true,
    },
    businessLines: [
      { id: 'boostic', icon: 'chart-line', color: '#3B82F6' },
      { id: 'binnacle', icon: 'chart-bar', color: '#8B5CF6' },
      { id: 'marketing', icon: 'megaphone', color: '#10B981' },
      { id: 'tech', icon: 'code', color: '#F59E0B' },
    ],
    businessHours: {
      timezone: 'Europe/Madrid',
      schedule: [{ days: [1, 2, 3, 4, 5], start: '09:00', end: '19:00' }],
      holidays: [],
    },
    messages: {
      welcomeDelay: 1000, typingDelay: 500,
      autoGreet: true, autoGreetDelay: 3000, inactivityTimeout: 1800,
    },
    sounds: { newMessage: 'notification', agentJoined: 'chime', callRinging: 'ring' },
  };
}

function getCopilotTheme(role = 'admin') {
  const validRoles = ['admin', 'boostic', 'binnacle', 'tech', 'business'];
  const safeRole = validRoles.includes(role) ? role : 'admin';
  return {
    language: `es-copilot-${safeRole}`,
    branding: {
      companyName: 'Sarah Copilot',
      logoUrl: '',
      faviconUrl: '',
      poweredByText: '',
      showPoweredBy: false,
    },
    colors: {
      primary: '#6366f1', primaryDark: '#4f46e5', primaryLight: '#eef2ff',
      secondary: '#1e1b4b', accent: '#818cf8',
      background: '#FFFFFF', surface: '#F5F5FF',
      text: '#1e1b4b', textSecondary: '#4b5563', textOnPrimary: '#FFFFFF',
      border: '#e0e7ff', success: '#10b981', warning: '#f59e0b', error: '#ef4444',
      gradientFrom: '#4f46e5', gradientTo: '#7c3aed', headerGradient: true,
    },
    typography: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: 14, headerFontSize: 15, messagesFontSize: 14,
    },
    layout: {
      position: 'bottom-right', offsetX: 20, offsetY: 20,
      width: 400, maxHeight: 650, borderRadius: 14,
      buttonSize: 54, buttonBorderRadius: 27, headerHeight: 60,
      zIndex: 2147483647, mobileFullscreen: true,
    },
    features: {
      enableVoip: false, enableFileUpload: true, enableEmoji: false,
      enableCsat: false, enableLeadForm: false, enableQuickReplies: true,
      enableRichMessages: true, enableSoundNotifications: false,
      enableReadReceipts: true, enableTypingIndicator: true,
      enableLanguageSelector: false, enableBusinessLines: false,
      enableDarkMode: false, enableAttachments: true,
      maxFileSize: 10485760,
      allowedFileTypes: ['image/*', 'application/pdf', '.doc', '.docx', '.xls', '.xlsx'],
    },
    i18n: {
      defaultLanguage: 'es-copilot',
      availableLanguages: ['es-copilot'],
      autoDetect: false,
    },
    businessLines: [],
    businessHours: {
      timezone: 'Europe/Madrid',
      schedule: [{ days: [1, 2, 3, 4, 5], start: '07:00', end: '22:00' }],
      holidays: [],
    },
    messages: {
      welcomeDelay: 500, typingDelay: 400,
      autoGreet: true, autoGreetDelay: 1500, inactivityTimeout: 3600,
    },
    sounds: { newMessage: 'notification', agentJoined: 'chime', callRinging: 'ring' },
  };
}

module.exports = router;
module.exports.getDefaultTheme = getDefaultTheme;
module.exports.getCopilotTheme = getCopilotTheme;
