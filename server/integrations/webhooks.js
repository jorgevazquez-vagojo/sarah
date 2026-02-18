const crypto = require('crypto');
const { db } = require('../utils/db');
const { logger } = require('../utils/logger');

async function triggerWebhooks(event, data) {
  const result = await db.query(
    `SELECT * FROM webhooks WHERE is_active = true AND $1 = ANY(events)`,
    [event]
  );

  for (const webhook of result.rows) {
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

module.exports = { triggerWebhooks, EVENTS };
