const { Router } = require('express');
const { db } = require('../utils/db');
const { redis } = require('../utils/redis');
const { requireAgent, requireApiKey } = require('../middleware/auth');
const { logger } = require('../utils/logger');

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

// ─── Admin: get full theme ───
router.get('/theme', requireAgent, async (req, res) => {
  const themes = await db.query(
    `SELECT wt.*, t.slug as tenant_slug FROM widget_themes wt
     JOIN tenants t ON t.id = wt.tenant_id
     ORDER BY wt.created_at`
  );
  res.json(themes.rows);
});

// ─── Admin: update theme ───
router.put('/theme/:id', requireAgent, async (req, res) => {
  const { config } = req.body;
  if (!config) return res.status(400).json({ error: 'config required' });

  const result = await db.query(
    `UPDATE widget_themes SET config = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [config, req.params.id]
  );

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

// ─── Admin: create tenant ───
router.post('/tenants', requireAgent, async (req, res) => {
  const { slug, name, domain } = req.body;
  if (!slug || !name) return res.status(400).json({ error: 'slug and name required' });

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

// ─── Admin: manage canned responses ───
router.get('/canned', requireAgent, async (req, res) => {
  const { language, businessLine } = req.query;
  const conds = ['1=1'];
  const vals = [];
  let i = 1;
  if (language) { conds.push(`language = $${i++}`); vals.push(language); }
  if (businessLine) { conds.push(`business_line = $${i++}`); vals.push(businessLine); }
  const result = await db.query(
    `SELECT * FROM canned_responses WHERE ${conds.join(' AND ')} ORDER BY usage_count DESC`,
    vals
  );
  res.json(result.rows);
});

router.post('/canned', requireAgent, async (req, res) => {
  const { shortcut, title, content, language, businessLine, category } = req.body;
  if (!shortcut || !title || !content) {
    return res.status(400).json({ error: 'shortcut, title, and content required' });
  }
  const result = await db.query(
    `INSERT INTO canned_responses (shortcut, title, content, language, business_line, category, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [shortcut, title, content, language || 'es', businessLine, category, req.agent.id]
  );
  res.json(result.rows[0]);
});

router.delete('/canned/:id', requireAgent, async (req, res) => {
  await db.query('DELETE FROM canned_responses WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ─── Admin: webhooks ───
router.get('/webhooks', requireAgent, async (req, res) => {
  const result = await db.query('SELECT * FROM webhooks ORDER BY created_at');
  res.json(result.rows);
});

router.post('/webhooks', requireAgent, async (req, res) => {
  const { url, events, secret } = req.body;
  if (!url || !events?.length) {
    return res.status(400).json({ error: 'url and events required' });
  }
  const result = await db.query(
    `INSERT INTO webhooks (url, events, secret) VALUES ($1, $2, $3) RETURNING *`,
    [url, events, secret]
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
      primary: '#E30613', primaryDark: '#B8050F', primaryLight: '#FEE2E2',
      secondary: '#1E293B', accent: '#F59E0B',
      background: '#FFFFFF', surface: '#F8FAFC',
      text: '#0F172A', textSecondary: '#64748B', textOnPrimary: '#FFFFFF',
      border: '#E2E8F0', success: '#10B981', warning: '#F59E0B', error: '#EF4444',
      gradientFrom: '#E30613', gradientTo: '#B8050F', headerGradient: true,
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

module.exports = router;
module.exports.getDefaultTheme = getDefaultTheme;
