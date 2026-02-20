const { db } = require('../utils/db');
const { logger } = require('../utils/logger');

async function generateTranscript(conversationId) {
  const conv = await db.getConversation(conversationId);
  if (!conv) throw new Error('Conversation not found');

  const messages = await db.getMessages(conversationId, 500);
  const lead = conv.visitor_id
    ? (await db.query('SELECT * FROM leads WHERE conversation_id = $1 LIMIT 1', [conversationId])).rows[0]
    : null;

  const lines = [];
  lines.push('═══════════════════════════════════════');
  lines.push('  REDEGAL - Transcripción de conversación');
  lines.push('═══════════════════════════════════════');
  lines.push('');
  lines.push(`Fecha: ${new Date(conv.started_at).toLocaleString('es-ES')}`);
  lines.push(`Idioma: ${conv.language || 'es'}`);
  if (conv.business_line) lines.push(`Línea: ${conv.business_line}`);
  if (lead) {
    lines.push(`Contacto: ${lead.name} (${lead.email})`);
    if (lead.company) lines.push(`Empresa: ${lead.company}`);
  }
  lines.push('');
  lines.push('───────────────────────────────────────');

  for (const msg of messages) {
    if (msg.sender === 'note') continue; // Skip internal notes
    const time = new Date(msg.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const sender = {
      visitor: '👤 Visitante',
      bot: '🤖 Bot',
      agent: `💬 ${msg.metadata?.agentName || 'Agente'}`,
      system: '⚙️ Sistema',
    }[msg.sender] || msg.sender;

    lines.push(`[${time}] ${sender}:`);
    lines.push(`  ${msg.content}`);
    lines.push('');
  }

  lines.push('───────────────────────────────────────');
  lines.push('Redegal - chatbot.redegal.com');

  return {
    text: lines.join('\n'),
    html: generateHtmlTranscript(conv, messages, lead),
    metadata: {
      conversationId,
      startedAt: conv.started_at,
      closedAt: conv.closed_at,
      language: conv.language,
      businessLine: conv.business_line,
      messageCount: messages.length,
    },
  };
}

function generateHtmlTranscript(conv, messages, lead) {
  const rows = messages
    .filter((m) => m.sender !== 'note')
    .map((m) => {
      const time = new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const isVisitor = m.sender === 'visitor';
      const bg = isVisitor ? '#007fff' : m.sender === 'agent' ? '#3B82F6' : '#F1F5F9';
      const color = isVisitor || m.sender === 'agent' ? '#FFF' : '#333';
      const align = isVisitor ? 'right' : 'left';
      const label = isVisitor ? 'Visitante' : m.sender === 'agent' ? (m.metadata?.agentName || 'Agente') : m.sender === 'bot' ? 'Bot' : 'Sistema';

      return `<div style="text-align:${align};margin:8px 0">
        <span style="font-size:11px;color:#999">${time} - ${label}</span><br>
        <span style="display:inline-block;max-width:80%;padding:10px 16px;border-radius:16px;background:${bg};color:${color};font-size:14px;line-height:1.5;text-align:left">${m.content}</span>
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>body{font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#F8FAFC}h2{color:#007fff}
.meta{background:#fff;padding:16px;border-radius:12px;border:1px solid #E2E8F0;margin:16px 0;font-size:13px;color:#64748B}
.meta strong{color:#0F172A}</style></head><body>
<h2>Redegal - Transcripción</h2>
<div class="meta">
  <strong>Fecha:</strong> ${new Date(conv.started_at).toLocaleString('es-ES')}<br>
  <strong>Idioma:</strong> ${conv.language || 'es'}
  ${conv.business_line ? `<br><strong>Línea:</strong> ${conv.business_line}` : ''}
  ${lead ? `<br><strong>Contacto:</strong> ${lead.name} (${lead.email})${lead.company ? ' - ' + lead.company : ''}` : ''}
</div>
${rows}
<p style="text-align:center;margin-top:24px;font-size:12px;color:#94A3B8">Redegal - chatbot.redegal.com</p>
</body></html>`;
}

module.exports = { generateTranscript };
