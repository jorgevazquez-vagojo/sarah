/**
 * Mailer client — Node.js
 * Drop-in for jorge-copiloto, sarah, and any Node.js project.
 *
 * Env vars required:
 *   MAILER_URL  — e.g. http://100.70.97.6:3210
 *   MAILER_KEY  — API key
 *
 * Usage:
 *   const { sendMail } = require('./mailer');
 *   await sendMail({ to: 'a@b.com', subject: 'Hi', html: '<b>Hello</b>' });
 */

const MAILER_URL = process.env.MAILER_URL;
const MAILER_KEY = process.env.MAILER_KEY;

/**
 * @param {object} opts
 * @param {string|string[]} opts.to
 * @param {string} opts.subject
 * @param {string} [opts.html]
 * @param {string} [opts.text]
 * @param {string} [opts.from]
 * @param {string} [opts.replyTo]
 * @returns {Promise<{ok: boolean, messageId?: string, error?: string}>}
 */
async function sendMail({ to, subject, html, text, from, replyTo }) {
  if (!MAILER_URL || !MAILER_KEY) {
    throw new Error('MAILER_URL and MAILER_KEY env vars are required');
  }

  const response = await fetch(`${MAILER_URL}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MAILER_KEY}`,
    },
    body: JSON.stringify({ to, subject, html, text, from, replyTo }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.error || `Mailer error: HTTP ${response.status}`);
  }

  return data;
}

module.exports = { sendMail };
