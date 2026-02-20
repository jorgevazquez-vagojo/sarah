/**
 * Email Service — Single notification email for all events
 *
 * All emails go to NOTIFICATION_EMAIL:
 *   - Escalation alert (visitor wants to talk to a human)
 *   - Call request alert (visitor wants a callback)
 *   - Conversation summary (when chat is closed)
 */

const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');
const { db } = require('../utils/db');

// Prevent XSS in HTML emails
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const settings = require('./settings');

let transporter = null;

async function initEmail() {
  await refreshTransporter();
}

async function refreshTransporter() {
  const cfg = await settings.getMany(['smtp.host', 'smtp.port', 'smtp.user', 'smtp.password']);
  const host = cfg['smtp.host'];
  const port = parseInt(cfg['smtp.port'] || '587', 10);
  const user = cfg['smtp.user'];
  const pass = cfg['smtp.password'];

  if (!host || !user || !pass) {
    logger.warn('Email: SMTP not configured — email notifications disabled');
    transporter = null;
    return;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  transporter.verify().then(() => {
    logger.info(`Email: SMTP connected (${host}:${port})`);
  }).catch((e) => {
    logger.error('Email: SMTP verification failed:', e.message);
  });
}

const FROM = async () => (await settings.get('smtp.from')) || 'chatbot@redegal.com';
const TO = async () => (await settings.get('notification.email')) || '';

const BU_LABELS = {
  boostic: 'Boostic (SEO & Growth)',
  binnacle: 'Binnacle (BI)',
  marketing: 'Marketing Digital',
  tech: 'Digital Tech',
};

async function sendEmail({ to, subject, html, text }) {
  // Lazy-init: if transporter is null, try refreshing (settings may have changed via panel)
  if (!transporter) await refreshTransporter();
  if (!transporter) return false;
  const recipients = to || (await TO());
  if (!recipients) {
    logger.warn('Email: No recipients (notification.email not set)');
    return false;
  }
  try {
    const from = await FROM();
    await transporter.sendMail({
      from: `"Redegal Chatbot" <${from}>`,
      to: recipients,
      subject,
      html,
      text,
    });
    logger.info(`Email: Sent "${subject}" → ${recipients}`);
    return true;
  } catch (e) {
    logger.error(`Email: Failed "${subject}":`, e.message);
    return false;
  }
}

// ─── Escalation: visitor wants human ───
async function notifyEscalation(conversationId, visitorId, businessLine, language) {
  const to = await TO();
  if (!to) return;

  let contextSnippet = '';
  try {
    const msgs = await db.query(
      `SELECT sender, content FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [conversationId]
    );
    contextSnippet = msgs.rows.reverse()
      .map((m) => `<strong>${escapeHtml(m.sender === 'visitor' ? 'Visitante' : m.sender)}:</strong> ${escapeHtml(m.content)}`)
      .join('<br>');
  } catch {}

  const buLabel = BU_LABELS[businessLine] || businessLine || 'General';
  const time = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F8FAFC;margin:0;padding:20px">
  <div style="max-width:520px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #E5E9F0">
    <div style="background:linear-gradient(135deg,#F59E0B,#D97706);padding:20px 24px;color:white">
      <h1 style="font-size:16px;margin:0">⚡ Lead Web quiere hablar</h1>
      <p style="font-size:12px;opacity:0.85;margin:4px 0 0">${buLabel} · ${time}</p>
    </div>
    <div style="padding:20px 24px">
      <p style="font-size:13px;color:#1A1A2E;line-height:1.6;margin:0 0 14px">
        Un visitante del chatbot ha pedido <strong>hablar con una persona</strong> del equipo de <strong>${buLabel}</strong>.
      </p>
      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:14px;margin-bottom:14px">
        <p style="font-size:12px;font-weight:600;color:#92400E;margin:0 0 4px">🔔 Accion requerida</p>
        <p style="font-size:12px;color:#92400E;margin:0">Entra al Dashboard de Agentes para atender esta conversacion. ${process.env.ASTERISK_AMI_HOST ? 'Tambien se ha lanzado una llamada a la extension de ' + buLabel + '.' : ''}</p>
      </div>
      ${contextSnippet ? `
      <div style="background:#F7F9FC;border:1px solid #E5E9F0;border-radius:10px;padding:14px;font-size:12px;color:#1A1A2E;line-height:1.7">
        <p style="font-size:11px;font-weight:600;color:#5A6178;margin:0 0 8px">Ultimos mensajes:</p>
        ${contextSnippet}
      </div>` : ''}
    </div>
    <div style="padding:12px 24px;background:#F7F9FC;border-top:1px solid #E5E9F0;text-align:center">
      <p style="font-size:10px;color:#9CA3AF;margin:0">Redegal Chatbot · Notificacion automatica</p>
    </div>
  </div>
</body></html>`;

  await sendEmail({
    to,
    subject: `⚡ [Chatbot] Lead Web quiere hablar — ${buLabel}`,
    html,
    text: `Lead Web quiere hablar\nLinea: ${buLabel}\nHora: ${time}\n\nEntra al Dashboard de Agentes para atender.`,
  });
}

// ─── Call request: visitor wants callback ───
async function notifyCallRequest(conversationId, phone, businessLine) {
  const to = await TO();
  if (!to) return;

  const buLabel = BU_LABELS[businessLine] || businessLine || 'General';
  const time = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F8FAFC;margin:0;padding:20px">
  <div style="max-width:520px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #E5E9F0">
    <div style="background:linear-gradient(135deg,#007fff,#0055CC);padding:20px 24px;color:white">
      <h1 style="font-size:16px;margin:0">📞 Lead Web pide que le llamen</h1>
      <p style="font-size:12px;opacity:0.85;margin:4px 0 0">${buLabel} · ${time}</p>
    </div>
    <div style="padding:20px 24px">
      <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:12px;padding:18px;text-align:center;margin-bottom:14px">
        <p style="font-size:11px;color:#5A6178;margin:0 0 6px;font-weight:500">Telefono del visitante</p>
        <a href="tel:${phone}" style="font-size:24px;font-weight:700;color:#007fff;text-decoration:none">${phone}</a>
      </div>
      <p style="font-size:12px;color:#5A6178;line-height:1.6;margin:0">
        ${process.env.ASTERISK_AMI_HOST ? 'Se ha lanzado una llamada automatica a la centralita con CallerID <strong>"Lead Web"</strong>.' : 'La centralita no esta configurada. Llama manualmente al visitante.'}
        ${process.env.ASTERISK_AMI_HOST ? ' Si no se ha completado, llama manualmente.' : ''}
      </p>
    </div>
    <div style="padding:12px 24px;background:#F7F9FC;border-top:1px solid #E5E9F0;text-align:center">
      <p style="font-size:10px;color:#9CA3AF;margin:0">Redegal Chatbot · Notificacion automatica</p>
    </div>
  </div>
</body></html>`;

  await sendEmail({
    to,
    subject: `📞 [Chatbot] Lead Web pide llamada — ${phone} (${buLabel})`,
    html,
    text: `Lead Web pide llamada\nTelefono: ${phone}\nLinea: ${buLabel}\nHora: ${time}`,
  });
}

// ─── Conversation summary on close ───
async function sendConversationSummary(conversationId) {
  const to = await TO();
  if (!to) return;

  try {
    const convResult = await db.query('SELECT * FROM conversations WHERE id = $1', [conversationId]);
    const conv = convResult.rows[0];
    if (!conv) return;

    const messagesResult = await db.query(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [conversationId]
    );
    const messages = messagesResult.rows;
    if (messages.length === 0) return;

    // Lead info
    let lead = null;
    try {
      const lr = await db.query(
        'SELECT * FROM leads WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1',
        [conversationId]
      );
      lead = lr.rows[0] || null;
    } catch {}

    const businessLine = conv.business_line || 'general';
    const buLabel = BU_LABELS[businessLine] || businessLine;
    const startTime = new Date(conv.started_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
    const closedTime = conv.closed_at
      ? new Date(conv.closed_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
      : new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
    const visibleMsgs = messages.filter((m) => m.sender !== 'note');
    const msgCount = visibleMsgs.filter((m) => m.sender !== 'system').length;

    // Transcript rows
    const transcript = visibleMsgs.map((m) => {
      const time = new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
      const senderColors = { visitor: '#007fff', agent: '#10B981', bot: '#64748B', system: '#9CA3AF' };
      const senderLabels = { visitor: 'Visitante', bot: 'Bot', agent: 'Agente', system: 'Sistema' };
      const label = senderLabels[m.sender] || m.sender;
      const agentName = m.metadata?.agentName ? ` (${m.metadata.agentName})` : '';
      return `<tr>
        <td style="padding:5px 8px;font-size:11px;color:#9CA3AF;white-space:nowrap;vertical-align:top">${time}</td>
        <td style="padding:5px 8px;font-size:11px;font-weight:600;color:${senderColors[m.sender] || '#64748B'};white-space:nowrap;vertical-align:top">${label}${agentName}</td>
        <td style="padding:5px 8px;font-size:13px;color:#1A1A2E;line-height:1.5">${escapeHtml(m.content)}</td>
      </tr>`;
    }).join('');

    const leadBlock = lead ? `
      <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:12px;padding:16px;margin:16px 0">
        <p style="font-size:13px;font-weight:700;color:#007fff;margin:0 0 10px">📋 Datos del lead</p>
        <table style="font-size:13px;color:#1A1A2E">
          ${lead.name ? `<tr><td style="padding:2px 10px 2px 0;font-weight:600">Nombre:</td><td>${lead.name}</td></tr>` : ''}
          ${lead.email ? `<tr><td style="padding:2px 10px 2px 0;font-weight:600">Email:</td><td><a href="mailto:${lead.email}" style="color:#007fff">${lead.email}</a></td></tr>` : ''}
          ${lead.phone ? `<tr><td style="padding:2px 10px 2px 0;font-weight:600">Telefono:</td><td><a href="tel:${lead.phone}" style="color:#007fff">${lead.phone}</a></td></tr>` : ''}
          ${lead.company ? `<tr><td style="padding:2px 10px 2px 0;font-weight:600">Empresa:</td><td>${lead.company}</td></tr>` : ''}
        </table>
      </div>` : '';

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F8FAFC;margin:0;padding:20px">
  <div style="max-width:620px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #E5E9F0">
    <div style="background:linear-gradient(135deg,#007fff,#0055CC);padding:24px 28px;color:white">
      <h1 style="font-size:18px;margin:0">Resumen de conversacion</h1>
      <p style="font-size:12px;opacity:0.85;margin:6px 0 0">${buLabel} · Cerrada ${closedTime}</p>
    </div>

    <div style="padding:24px 28px">
      <table style="width:100%;margin-bottom:18px" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#F7F9FC;border-radius:10px;padding:12px;text-align:center;width:25%">
            <div style="font-size:20px;font-weight:700;color:#1A1A2E">${msgCount}</div>
            <div style="font-size:10px;color:#5A6178;margin-top:2px">Mensajes</div>
          </td>
          <td style="width:8px"></td>
          <td style="background:#F7F9FC;border-radius:10px;padding:12px;text-align:center;width:25%">
            <div style="font-size:12px;font-weight:600;color:#1A1A2E">${startTime.split(',')[1]?.trim() || startTime}</div>
            <div style="font-size:10px;color:#5A6178;margin-top:2px">Inicio</div>
          </td>
          <td style="width:8px"></td>
          <td style="background:#F7F9FC;border-radius:10px;padding:12px;text-align:center;width:25%">
            <div style="font-size:12px;font-weight:600;color:#1A1A2E">${conv.language || 'es'}</div>
            <div style="font-size:10px;color:#5A6178;margin-top:2px">Idioma</div>
          </td>
          <td style="width:8px"></td>
          <td style="background:#F7F9FC;border-radius:10px;padding:12px;text-align:center;width:25%">
            <div style="font-size:12px;font-weight:600;color:#1A1A2E">${buLabel.split(' (')[0]}</div>
            <div style="font-size:10px;color:#5A6178;margin-top:2px">Linea</div>
          </td>
        </tr>
      </table>

      ${leadBlock}

      <p style="font-size:13px;font-weight:700;color:#1A1A2E;margin:18px 0 10px">💬 Transcripcion completa</p>
      <table style="width:100%;border-collapse:collapse;background:#FAFBFC;border-radius:10px;overflow:hidden;border:1px solid #E5E9F0">
        ${transcript}
      </table>
    </div>

    <div style="padding:14px 28px;background:#F7F9FC;border-top:1px solid #E5E9F0;text-align:center">
      <p style="font-size:10px;color:#9CA3AF;margin:0">Redegal · A Smart Digital Company</p>
    </div>
  </div>
</body></html>`;

    const plainTranscript = visibleMsgs
      .map((m) => `[${m.sender}${m.metadata?.agentName ? ' ' + m.metadata.agentName : ''}] ${m.content}`)
      .join('\n');

    await sendEmail({
      to,
      subject: `[Chatbot] Resumen — ${buLabel} (${startTime})`,
      html,
      text: `Resumen de conversacion\nLinea: ${buLabel}\nInicio: ${startTime}\nCierre: ${closedTime}\nMensajes: ${msgCount}\n\n${plainTranscript}`,
    });
  } catch (e) {
    logger.error('Email: Summary error:', e.message);
  }
}

module.exports = { initEmail, refreshTransporter, sendEmail, sendConversationSummary, notifyEscalation, notifyCallRequest };
