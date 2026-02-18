const crypto = require('crypto');
const { db } = require('../utils/db');
const { logger } = require('../utils/logger');

// Block internal/private network URLs to prevent SSRF
function isAllowedUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    // Block private/internal ranges
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
    if (host === '0.0.0.0' || host.endsWith('.local') || host.endsWith('.internal')) return false;
    if (/^10\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^192\.168\./.test(host)) return false;
    if (host === '169.254.169.254') return false; // AWS metadata
    return true;
  } catch {
    return false;
  }
}

async function triggerWebhooks(event, data) {
  const result = await db.query(
    `SELECT * FROM webhooks WHERE is_active = true AND $1 = ANY(events) AND failure_count < 50`,
    [event]
  );

  for (const webhook of result.rows) {
    if (!isAllowedUrl(webhook.url)) {
      logger.warn(`Webhook ${webhook.id}: blocked SSRF attempt to ${webhook.url}`);
      continue;
    }
    fireWebhook(webhook, event, data).catch((e) => {
      logger.warn(`Webhook ${webhook.id} failed: ${e.message}`);
      db.query(
        `UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = $1`,
        [webhook.id]
      );
    });
  }
}

async function fireWebhook(webhook, event, data) {
  const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  const headers = { 'Content-Type': 'application/json' };

  if (webhook.secret) {
    const signature = crypto.createHmac('sha256', webhook.secret).update(payload).digest('hex');
    headers['X-Webhook-Signature'] = `sha256=${signature}`;
  }

  const res = await fetch(webhook.url, {
    method: 'POST',
    headers,
    body: payload,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  await db.query(
    `UPDATE webhooks SET last_triggered_at = NOW(), failure_count = 0 WHERE id = $1`,
    [webhook.id]
  );

  logger.info(`Webhook ${webhook.id}: ${event} -> ${res.status}`);
}

// Supported webhook events
const EVENTS = [
  'conversation.started',
  'conversation.closed',
  'message.received',
  'message.sent',
  'lead.created',
  'lead.updated',
  'agent.assigned',
  'call.started',
  'call.ended',
  'csat.submitted',
];

module.exports = { triggerWebhooks, EVENTS, isAllowedUrl };
