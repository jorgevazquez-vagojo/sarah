const { aiComplete } = require('./ai');
const { getContextForLine, searchKnowledge } = require('./knowledge-base');
const { t } = require('../utils/i18n');
const { logger } = require('../utils/logger');

const BUSINESS_LINES = ['boostic', 'binnacle', 'marketing', 'tech'];

const LINE_KEYWORDS = {
  boostic:   ['seo', 'posicionamiento', 'growth', 'analytics', 'orgánico', 'tráfico', 'cro', 'conversión', 'keywords', 'crawl'],
  binnacle:  ['bi', 'business intelligence', 'dashboard', 'datos', 'data', 'warehouse', 'bigquery', 'looker', 'kpi', 'etl', 'reporting'],
  marketing: ['sem', 'publicidad', 'ads', 'social media', 'redes sociales', 'campañas', 'email marketing', 'facebook', 'google ads', 'tiktok'],
  tech:      ['desarrollo', 'web', 'app', 'aplicación', 'e-commerce', 'ecommerce', 'magento', 'shopify', 'programación', 'api', 'cloud', 'integración'],
};

function detectBusinessLine(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  const scores = {};
  for (const [line, keywords] of Object.entries(LINE_KEYWORDS)) {
    scores[line] = keywords.filter((k) => lower.includes(k)).length;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : null;
}

const SYSTEM_PROMPT_TEMPLATE = `Eres el asistente virtual de Redegal, una consultora digital líder en España.
Tu objetivo es ayudar a los visitantes de la web proporcionando información sobre los servicios de Redegal
y captando leads comerciales de forma natural y no intrusiva.

IDIOMA: Responde SIEMPRE en {{language_name}}.

TONO: Profesional pero cercano. Conciso. Usa bullet points cuando sea útil.

LÍNEA DE NEGOCIO: {{business_line_context}}

BASE DE CONOCIMIENTO:
{{knowledge}}

REGLAS:
1. Responde solo con información de la base de conocimiento. Si no sabes algo, di que consultarás con el equipo.
2. Si el visitante muestra interés comercial, sugiere amablemente dejar sus datos de contacto.
3. Si pide hablar con alguien, ofrece conectar con un agente o programar una llamada.
4. No inventes datos, cifras ni nombres de clientes específicos que no estén en la base de conocimiento.
5. Máximo 3-4 párrafos cortos por respuesta.`;

const LANGUAGE_NAMES = { es: 'español', gl: 'gallego', en: 'inglés', 'es-MX': 'español mexicano' };

async function generateResponse({ message, language, businessLine, conversationHistory }) {
  const line = businessLine || detectBusinessLine(message) || 'general';
  const context = getContextForLine(line);
  const kbResults = await searchKnowledge(message, line === 'general' ? null : line, language);
  const extraKb = kbResults.map((r) => `- ${r.title}: ${r.content || ''}`).join('\n');

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE
    .replace('{{language_name}}', LANGUAGE_NAMES[language] || 'español')
    .replace('{{business_line_context}}', line !== 'general' ? `Estás atendiendo consultas sobre ${line.toUpperCase()}.` : 'No se ha identificado línea de negocio específica aún.')
    .replace('{{knowledge}}', context + (extraKb ? `\n\nRESULTADOS DE BÚSQUEDA:\n${extraKb}` : ''));

  const historyText = (conversationHistory || [])
    .slice(-6)
    .map((m) => `${m.sender === 'visitor' ? 'Usuario' : 'Asistente'}: ${m.content}`)
    .join('\n');

  const userPrompt = historyText
    ? `Historial reciente:\n${historyText}\n\nNuevo mensaje del usuario: ${message}`
    : message;

  const response = await aiComplete(systemPrompt, userPrompt);
  return { response, detectedLine: line };
}

function isBusinessHours() {
  const tz = process.env.TIMEZONE || 'Europe/Madrid';
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const start = parseInt(process.env.BUSINESS_HOURS_START || '9');
  const end = parseInt(process.env.BUSINESS_HOURS_END || '19');
  return day >= 1 && day <= 5 && hour >= start && hour < end;
}

module.exports = { generateResponse, detectBusinessLine, isBusinessHours, BUSINESS_LINES };
