const { aiComplete } = require('./ai');
const { getContextForLine, searchKnowledge, vectorSearchKnowledge } = require('./knowledge-base');
const { findLearnedResponses } = require('./learning');
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

{{learned_context}}

REGLAS:
1. Responde solo con información de la base de conocimiento. Si no sabes algo, di que consultarás con el equipo.
2. Si el visitante muestra interés comercial, sugiere amablemente dejar sus datos de contacto.
3. Si pide hablar con alguien, ofrece conectar con un agente o programar una llamada.
4. No inventes datos, cifras ni nombres de clientes específicos que no estén en la base de conocimiento.
5. Máximo 3-4 párrafos cortos por respuesta.
6. Si hay respuestas aprendidas de interacciones previas, úsalas como referencia para el tono y contenido.`;

const LANGUAGE_NAMES = { es: 'español', gl: 'gallego', en: 'inglés', pt: 'portugués' };

async function generateResponse({ message, language, businessLine, conversationHistory }) {
  const line = businessLine || detectBusinessLine(message) || 'general';
  const context = getContextForLine(line);

  // Full-text search (existing)
  const kbResults = await searchKnowledge(message, line === 'general' ? null : line, language);
  const extraKb = kbResults.map((r) => `- ${r.title}: ${r.content || ''}`).join('\n');

  // RAG: vector search on knowledge base
  let vectorKb = '';
  try {
    const vectorResults = await vectorSearchKnowledge(message, line === 'general' ? null : line, 3);
    if (vectorResults.length > 0) {
      vectorKb = '\n\nBÚSQUEDA SEMÁNTICA:\n' + vectorResults.map((r) => `- ${r.title}: ${r.content}`).join('\n');
    }
  } catch (e) {
    logger.debug('Vector KB search unavailable:', e.message);
  }

  // RAG: learned responses from feedback loop
  let learnedContext = '';
  try {
    const learned = await findLearnedResponses(message, line === 'general' ? null : line, 3);
    if (learned.length > 0) {
      learnedContext = 'RESPUESTAS APRENDIDAS (referencia de interacciones previas exitosas):\n' +
        learned.map((r) => `- Pregunta similar: "${r.visitor_pattern}"\n  Respuesta exitosa: "${r.ideal_response}"`).join('\n');
    }
  } catch (e) {
    logger.debug('Learned responses unavailable:', e.message);
  }

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE
    .replace('{{language_name}}', LANGUAGE_NAMES[language] || 'español')
    .replace('{{business_line_context}}', line !== 'general' ? `Estás atendiendo consultas sobre ${line.toUpperCase()}.` : 'No se ha identificado línea de negocio específica aún.')
    .replace('{{knowledge}}', context + (extraKb ? `\n\nRESULTADOS DE BÚSQUEDA:\n${extraKb}` : '') + vectorKb)
    .replace('{{learned_context}}', learnedContext);

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
  // Use Intl.DateTimeFormat for reliable timezone conversion
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
    weekday: 'short',
  });
  const parts = fmt.formatToParts(new Date());
  const hour = parseInt(parts.find((p) => p.type === 'hour').value);
  const weekday = parts.find((p) => p.type === 'weekday').value;
  const weekend = new Set(['Sat', 'Sun']);
  const start = parseInt(process.env.BUSINESS_HOURS_START || '9');
  const end = parseInt(process.env.BUSINESS_HOURS_END || '19');
  return !weekend.has(weekday) && hour >= start && hour < end;
}

module.exports = { generateResponse, detectBusinessLine, isBusinessHours, BUSINESS_LINES };
