/**
 * Callback Scheduler Service — Premium scheduled callback management.
 *
 * Handles scheduling, querying, and updating callbacks requested by visitors
 * through the Calendly-style widget UI.
 *
 * ─── SQL MIGRATION ─────────────────────────────────────────────────────────
 * Run this SQL to create the callbacks table:
 *
 * CREATE TABLE IF NOT EXISTS callbacks (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   visitor_id VARCHAR(64) NOT NULL,
 *   conversation_id UUID REFERENCES conversations(id),
 *   phone VARCHAR(32) NOT NULL,
 *   name VARCHAR(100),
 *   scheduled_date DATE NOT NULL,
 *   time_slot VARCHAR(20) NOT NULL,
 *   time_range VARCHAR(20) NOT NULL,
 *   business_line VARCHAR(30),
 *   language VARCHAR(5) DEFAULT 'es',
 *   note TEXT,
 *   status VARCHAR(20) DEFAULT 'pending',
 *   agent_id UUID REFERENCES agents(id),
 *   completed_at TIMESTAMPTZ,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * CREATE INDEX IF NOT EXISTS idx_callbacks_date_status ON callbacks(scheduled_date, status);
 * CREATE INDEX IF NOT EXISTS idx_callbacks_business_line ON callbacks(business_line);
 * ─── END SQL ───────────────────────────────────────────────────────────────
 */

const { db } = require('../utils/db');
const { logger } = require('../utils/logger');
const { sendEmail } = require('./email');
const settings = require('./settings');

const BU_LABELS = {
  boostic: 'Boostic (SEO & Growth)',
  binnacle: 'Binnacle (BI)',
  marketing: 'Marketing Digital',
  tech: 'Digital Tech',
};

const TIME_SLOT_LABELS = {
  morning: { es: 'Mañana (9:00 - 12:00)', en: 'Morning (9:00 - 12:00)' },
  midday: { es: 'Mediodía (12:00 - 15:00)', en: 'Midday (12:00 - 15:00)' },
  afternoon: { es: 'Tarde (15:00 - 19:00)', en: 'Afternoon (15:00 - 19:00)' },
};

/**
 * Validate a phone number (basic E.164-ish).
 * Accepts: +34600123456, 600123456, +1-555-123-4567, etc.
 * @param {string} phone
 * @returns {boolean}
 */
function isValidPhone(phone) {
  if (!phone) return false;
  const clean = phone.replace(/[\s\-().]/g, '');
  // Must be at least 9 digits, optionally starting with +
  return /^\+?\d{9,15}$/.test(clean);
}

/**
 * Check that a date+slot is in the future.
 * @param {string} dateStr - ISO date YYYY-MM-DD
 * @param {string} timeSlot - 'morning'|'midday'|'afternoon'
 * @returns {boolean}
 */
function isSlotInFuture(dateStr, timeSlot) {
  const slotEndHours = { morning: 12, midday: 15, afternoon: 19 };
  const endHour = slotEndHours[timeSlot] || 19;

  const slotEnd = new Date(`${dateStr}T${String(endHour).padStart(2, '0')}:00:00`);
  // Assume Europe/Madrid timezone for comparison
  const now = new Date();
  return slotEnd > now;
}

/**
 * Ensure the callbacks table exists (auto-migration).
 */
async function ensureCallbacksTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS callbacks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visitor_id VARCHAR(64) NOT NULL,
        conversation_id UUID,
        phone VARCHAR(32) NOT NULL,
        name VARCHAR(100),
        scheduled_date DATE NOT NULL,
        time_slot VARCHAR(20) NOT NULL,
        time_range VARCHAR(20) NOT NULL,
        business_line VARCHAR(30),
        language VARCHAR(5) DEFAULT 'es',
        note TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        agent_id UUID,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_callbacks_date_status ON callbacks(scheduled_date, status)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_callbacks_business_line ON callbacks(business_line)`);
  } catch (e) {
    // Table may already exist with slightly different schema — that's fine
    if (!e.message.includes('already exists')) {
      logger.error('Callbacks table migration error:', e.message);
    }
  }
}

// Run migration on module load
ensureCallbacksTable();

/**
 * Schedule a new callback.
 * @param {object} params
 * @param {string} params.phone
 * @param {string} [params.name]
 * @param {string} params.date - ISO date YYYY-MM-DD
 * @param {string} params.timeSlot - 'morning'|'midday'|'afternoon'
 * @param {string} params.timeRange - '09:00-12:00'
 * @param {string} [params.businessLine]
 * @param {string} params.visitorId
 * @param {string} [params.conversationId]
 * @param {string} [params.language]
 * @param {string} [params.note]
 * @returns {Promise<{callbackId: string, scheduledFor: string}>}
 */
async function scheduleCallback({ phone, name, date, timeSlot, timeRange, businessLine, visitorId, conversationId, language, note }) {
  // 1. Validate phone
  if (!isValidPhone(phone)) {
    throw Object.assign(new Error('Invalid phone number'), { status: 400 });
  }

  // 2. Validate time slot
  const validSlots = ['morning', 'midday', 'afternoon'];
  if (!validSlots.includes(timeSlot)) {
    throw Object.assign(new Error('Invalid time slot'), { status: 400 });
  }

  // 3. Validate date (must be YYYY-MM-DD and not in the past)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw Object.assign(new Error('Invalid date format'), { status: 400 });
  }

  if (!isSlotInFuture(date, timeSlot)) {
    throw Object.assign(new Error('Selected time slot is in the past'), { status: 400 });
  }

  // 4. Prevent duplicate callbacks (same visitor, same date+slot, pending)
  const existing = await db.query(
    `SELECT id FROM callbacks
     WHERE visitor_id = $1 AND scheduled_date = $2 AND time_slot = $3 AND status = 'pending'`,
    [visitorId, date, timeSlot]
  );
  if (existing.rows.length > 0) {
    // Return the existing callback instead of creating a duplicate
    return { callbackId: existing.rows[0].id, scheduledFor: `${date} ${timeRange}` };
  }

  // 5. Insert into callbacks table
  const result = await db.query(
    `INSERT INTO callbacks (visitor_id, conversation_id, phone, name, scheduled_date, time_slot, time_range, business_line, language, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, scheduled_date, time_range`,
    [visitorId, conversationId || null, phone, name || null, date, timeSlot, timeRange || '', businessLine || null, language || 'es', note || null]
  );

  const callback = result.rows[0];
  const callbackId = callback.id;
  const scheduledFor = `${date} ${timeRange}`;

  logger.info(`Callback scheduled: ${callbackId} for ${phone} on ${scheduledFor} (${businessLine || 'general'})`);

  // 6. Track analytics event
  try {
    await db.trackEvent({
      eventType: 'callback_scheduled',
      conversationId: conversationId || null,
      visitorId,
      businessLine: businessLine || null,
      language: language || 'es',
      data: { callbackId, phone, date, timeSlot, timeRange, name },
    });
  } catch (e) {
    logger.warn('Failed to track callback analytics:', e.message);
  }

  // 7. Send email notification (async, don't block)
  notifyCallbackScheduled({ callbackId, phone, name, date, timeSlot, timeRange, businessLine, language }).catch((e) => {
    logger.warn('Failed to send callback notification email:', e.message);
  });

  return { callbackId, scheduledFor };
}

/**
 * Get available time slots for a given date.
 * @param {string} date - ISO date YYYY-MM-DD
 * @param {string} [businessLine]
 * @returns {Promise<Array<{slot: string, timeRange: string, available: boolean, agentCount: number}>>}
 */
async function getAvailableSlots(date, businessLine) {
  const slots = [
    { slot: 'morning',   timeRange: '09:00-12:00', start: 9,  end: 12 },
    { slot: 'midday',    timeRange: '12:00-15:00', start: 12, end: 15 },
    { slot: 'afternoon', timeRange: '15:00-19:00', start: 15, end: 19 },
  ];

  // Check how many pending callbacks exist per slot for this date
  const existingResult = await db.query(
    `SELECT time_slot, COUNT(*) as count FROM callbacks
     WHERE scheduled_date = $1 AND status = 'pending'
     ${businessLine ? 'AND business_line = $2' : ''}
     GROUP BY time_slot`,
    businessLine ? [date, businessLine] : [date]
  );

  const pendingCounts = {};
  for (const row of existingResult.rows) {
    pendingCounts[row.time_slot] = parseInt(row.count);
  }

  // Count available agents (online or with matching business_line)
  let agentCount = 3; // default fallback
  try {
    const agentResult = await db.query(
      `SELECT COUNT(*) as count FROM agents
       WHERE ($1::text IS NULL OR $1 = ANY(business_lines))`,
      [businessLine || null]
    );
    agentCount = Math.max(parseInt(agentResult.rows[0]?.count || '0'), 1);
  } catch {
    // Silently use default
  }

  return slots.map((s) => {
    const pending = pendingCounts[s.slot] || 0;
    const pastSlot = !isSlotInFuture(date, s.slot);
    // Consider a slot full if pending callbacks >= agents * 2
    const maxPerSlot = agentCount * 2;
    const available = !pastSlot && pending < maxPerSlot;
    // Show remaining capacity as "agent count"
    const remaining = Math.max(agentCount - Math.floor(pending / 2), 0);

    return {
      slot: s.slot,
      timeRange: s.timeRange,
      available,
      agentCount: pastSlot ? 0 : remaining,
    };
  });
}

/**
 * Get pending callbacks (for dashboard).
 * @param {object} [filters]
 * @param {string} [filters.businessLine]
 * @param {string} [filters.date]
 * @param {string} [filters.status]
 * @param {number} [filters.limit]
 * @param {number} [filters.offset]
 * @returns {Promise<Array>}
 */
async function getPendingCallbacks({ businessLine, date, status, limit = 50, offset = 0 } = {}) {
  const conds = [];
  const vals = [];
  let i = 1;

  if (businessLine) {
    conds.push(`business_line = $${i++}`);
    vals.push(businessLine);
  }
  if (date) {
    conds.push(`scheduled_date = $${i++}`);
    vals.push(date);
  }
  if (status) {
    conds.push(`status = $${i++}`);
    vals.push(status);
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  vals.push(limit, offset);

  const result = await db.query(
    `SELECT c.*, a.display_name as agent_name
     FROM callbacks c
     LEFT JOIN agents a ON c.agent_id = a.id
     ${where}
     ORDER BY c.scheduled_date ASC, c.time_slot ASC, c.created_at ASC
     LIMIT $${i++} OFFSET $${i}`,
    vals
  );

  return result.rows;
}

/**
 * Update callback status.
 * @param {string} callbackId
 * @param {string} status - 'confirmed'|'completed'|'missed'|'cancelled'
 * @param {string} [agentId]
 * @returns {Promise<object>}
 */
async function updateCallbackStatus(callbackId, status, agentId) {
  const validStatuses = ['pending', 'confirmed', 'completed', 'missed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw Object.assign(new Error('Invalid status'), { status: 400 });
  }

  const completedAt = ['completed', 'missed', 'cancelled'].includes(status) ? new Date().toISOString() : null;

  const result = await db.query(
    `UPDATE callbacks
     SET status = $2, agent_id = COALESCE($3, agent_id), completed_at = COALESCE($4::timestamptz, completed_at), updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [callbackId, status, agentId || null, completedAt]
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error('Callback not found'), { status: 404 });
  }

  logger.info(`Callback ${callbackId} updated to ${status}${agentId ? ` by agent ${agentId}` : ''}`);

  return result.rows[0];
}

/**
 * Send email notification when a callback is scheduled.
 * @param {object} params
 */
async function notifyCallbackScheduled({ callbackId, phone, name, date, timeSlot, timeRange, businessLine, language }) {
  const to = await (async () => {
    const email = await settings.get('notification.email');
    return email || '';
  })();

  if (!to) {
    logger.warn('Callback notification: no notification email configured');
    return;
  }

  const buLabel = BU_LABELS[businessLine] || businessLine || 'General';
  const slotLabel = TIME_SLOT_LABELS[timeSlot]?.es || timeSlot;
  const displayName = name || 'Visitante web';
  const dateObj = new Date(date + 'T12:00:00');
  const dateFormatted = dateObj.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const now = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

  // Prevent XSS
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F8FAFC;margin:0;padding:20px">
  <div style="max-width:520px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #E5E9F0">
    <div style="background:linear-gradient(135deg,#007fff,#0055CC);padding:24px 28px;color:white">
      <h1 style="font-size:18px;margin:0">\u{1F4DE} Callback programado</h1>
      <p style="font-size:12px;opacity:0.85;margin:6px 0 0">${esc(buLabel)} \u00b7 Solicitado ${esc(now)}</p>
    </div>

    <div style="padding:24px 28px">
      <p style="font-size:14px;color:#1A1A2E;line-height:1.6;margin:0 0 18px">
        <strong>${esc(displayName)}</strong> ha programado una llamada de callback.
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
        <tr>
          <td style="background:#F0F9FF;border-radius:10px;padding:14px;text-align:center;width:33%">
            <div style="font-size:10px;color:#5A6178;font-weight:500;margin-bottom:4px">\u{1F4C5} Fecha</div>
            <div style="font-size:13px;font-weight:700;color:#1A1A2E;text-transform:capitalize">${esc(dateFormatted)}</div>
          </td>
          <td style="width:8px"></td>
          <td style="background:#F0F9FF;border-radius:10px;padding:14px;text-align:center;width:33%">
            <div style="font-size:10px;color:#5A6178;font-weight:500;margin-bottom:4px">\u23F0 Franja</div>
            <div style="font-size:13px;font-weight:700;color:#1A1A2E">${esc(slotLabel)}</div>
          </td>
          <td style="width:8px"></td>
          <td style="background:#F0F9FF;border-radius:10px;padding:14px;text-align:center;width:33%">
            <div style="font-size:10px;color:#5A6178;font-weight:500;margin-bottom:4px">\u{1F3E2} Linea</div>
            <div style="font-size:13px;font-weight:700;color:#1A1A2E">${esc(buLabel.split(' (')[0])}</div>
          </td>
        </tr>
      </table>

      <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:14px;padding:20px;text-align:center;margin-bottom:18px">
        <p style="font-size:11px;color:#5A6178;margin:0 0 8px;font-weight:500">Tel\u00e9fono del visitante</p>
        <a href="tel:${esc(phone)}" style="font-size:26px;font-weight:800;color:#007fff;text-decoration:none;letter-spacing:0.5px">${esc(phone)}</a>
        ${name ? `<p style="font-size:13px;color:#1A1A2E;margin:10px 0 0;font-weight:600">${esc(name)}</p>` : ''}
      </div>

      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:14px">
        <p style="font-size:12px;font-weight:600;color:#92400E;margin:0 0 4px">\u{1F514} Acci\u00f3n requerida</p>
        <p style="font-size:12px;color:#92400E;margin:0;line-height:1.5">
          Llama a este visitante durante la franja <strong>${esc(timeRange)}</strong> del <strong>${esc(dateFormatted)}</strong>.
          Puedes ver y gestionar callbacks en el Dashboard de Agentes.
        </p>
      </div>
    </div>

    <div style="padding:14px 28px;background:#F7F9FC;border-top:1px solid #E5E9F0;text-align:center">
      <p style="font-size:10px;color:#9CA3AF;margin:0">Redegal \u00b7 A Smart Digital Company</p>
    </div>
  </div>
</body></html>`;

  const text = `Callback programado
Nombre: ${displayName}
Telefono: ${phone}
Fecha: ${dateFormatted}
Franja: ${slotLabel}
Linea: ${buLabel}
Hora solicitud: ${now}

Llama a este visitante durante la franja indicada.`;

  await sendEmail({
    to,
    subject: `\u{1F4DE} Callback programado: ${displayName} \u2014 ${dateFormatted} ${timeRange}`,
    html,
    text,
  });
}

module.exports = {
  scheduleCallback,
  getAvailableSlots,
  getPendingCallbacks,
  updateCallbackStatus,
  ensureCallbacksTable,
};
