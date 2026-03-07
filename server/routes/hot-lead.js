const { Router } = require('express');
const { logger } = require('../utils/logger');
const { asyncRoute } = require('../middleware/error-handler');

const router = Router();

// POST /api/hot-lead — receive hot lead notification from Bran Mecano
// Auth: X-Service-Key header matching BRAN_SERVICE_KEY env var
router.post('/', asyncRoute(async (req, res) => {
  const serviceKey = req.headers['x-service-key'];
  const expectedKey = process.env.BRAN_SERVICE_KEY;

  if (expectedKey && serviceKey !== expectedKey) {
    logger.warn('hot-lead: unauthorized request (invalid X-Service-Key)');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { event, data } = req.body || {};
  if (event !== 'hot_lead' || !data?.domain) {
    return res.status(400).json({ error: 'Invalid payload: expected event=hot_lead and data.domain' });
  }

  const { domain, company_name, business_line, total_score, contact_email, contact_name, language } = data;

  logger.info('hot-lead received: %s (%s) — %s score=%.1f', company_name, domain, business_line, total_score);

  // Store in DB for agent visibility (best-effort, non-blocking on failure)
  try {
    const { db } = require('../utils/db');
    await db.query(
      `INSERT INTO hot_lead_flags
         (domain, company_name, business_line, total_score, contact_email, contact_name, language, received_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (domain, business_line) DO UPDATE
         SET total_score = EXCLUDED.total_score,
             company_name = EXCLUDED.company_name,
             contact_email = COALESCE(EXCLUDED.contact_email, hot_lead_flags.contact_email),
             contact_name = COALESCE(EXCLUDED.contact_name, hot_lead_flags.contact_name),
             received_at = NOW()`,
      [domain, company_name || domain, business_line || 'unknown', total_score || 0,
       contact_email || null, contact_name || null, language || 'es']
    );
  } catch (e) {
    // Table may not exist yet — log and continue
    logger.warn('hot-lead: DB insert failed (table may need migration): %s', e.message);
  }

  res.json({ ok: true, domain, business_line });
}));

module.exports = router;
