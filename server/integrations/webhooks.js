const crypto = require('crypto');
const { db } = require('../utils/db');
const { logger } = require('../utils/logger');

// Block internal/private network URLs to prevent SSRF
function isAllowedUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
    if (host === '0.0.0.0' || host.endsWith('.local') || host.endsWith('.internal')) return false;
    if (/^10\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^192\.168\./.test(host)) return false;
    if (host === '169.254.169.254') return false; // AWS metadata
    return true;
  } catch {
    return false;
  }
}

async function triggerWebhooks(event, data, tenantId) {
  let result;
  if (tenantId) {
    result = await db.query(
      `SELECT * FROM webhooks WHERE is_active = true AND $1 = ANY(events) AND failure_count < 50 AND tenant_id = $2`,
      [event, tenantId]
    );
  } else {
    result = await db.query(
      `SELECT * FROM webhooks WHERE is_active = true AND $1 = ANY(events) AND failure_count < 50`,
      [event]
    );
  }

  for (const webhook of result.rows) {
    if (!isAllowedUrl(webhook.url)) {
      logger.warn(`Webhook ${webhook.id}: blocked SSRF attempt to ${webhook.url}`);
      continue;
    }
    fireWebhookWithRetry(webhook, event, data, 0);
  }
}

const MAX_RETRIES = 5;
const BACKOFF_BASE_MS = 5000; // 5s, 10s, 20s, 40s, 80s

async function fireWebhookWithRetry(webhook, event, data, attempt) {
  try {
    await fireWebhook(webhook, event, data);
  } catch (e) {
    if (attempt < MAX_RETRIES) {
      const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
      logger.warn(`Webhook ${webhook.id}: attempt ${attempt + 1} failed (${e.message}), retrying in ${delay}ms`);
      setTimeout(() => fireWebhookWithRetry(webhook, event, data, attempt + 1), delay);
    } else {
      logger.error(`Webhook ${webhook.id}: failed after ${MAX_RETRIES + 1} attempts for event ${event}`);
      await db.query(
        `UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = $1`,
        [webhook.id]
      ).catch(() => {});

      // Log delivery failure
      logDelivery(webhook.id, event, data, null, e.message, attempt + 1).catch(() => {});
    }
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

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // Log failed delivery
    logDelivery(webhook.id, event, data, res.status, body.slice(0, 500), 1).catch(() => {});
    throw new Error(`HTTP ${res.status}`);
  }

  await db.query(
    `UPDATE webhooks SET last_triggered_at = NOW(), failure_count = 0 WHERE id = $1`,
    [webhook.id]
  );

  // Log successful delivery
  logDelivery(webhook.id, event, data, res.status, null, 1).catch(() => {});

  logger.info(`Webhook ${webhook.id}: ${event} -> ${res.status}`);
}

// Delivery log for debugging (best-effort, table may not exist yet)
async function logDelivery(webhookId, event, data, responseStatus, responseBody, attempt) {
  try {
    await db.query(
      `INSERT INTO webhook_deliveries (webhook_id, event, payload, response_status, response_body, attempt)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [webhookId, event, JSON.stringify(data).slice(0, 5000), responseStatus, responseBody, attempt]
    );
  } catch {
    // Table may not exist — silently skip
  }
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
  'agent.transferred',
  'call.started',
  'call.ended',
  'csat.submitted',
];

module.exports = { triggerWebhooks, EVENTS, isAllowedUrl };
