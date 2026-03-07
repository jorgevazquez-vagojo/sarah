const { aiComplete } = require('./ai');
const { getContextForLine, searchKnowledge, vectorSearchKnowledge } = require('./knowledge-base');
const { findLearnedResponses } = require('./learning');
const { t } = require('../utils/i18n');
const { logger } = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const BUSINESS_LINES = ['boostic', 'binnacle', 'marketing', 'tech'];

// ── Copilot mode (internal tools: Agatha, Bran, Optimus) ────────────────────

let _copilotKb = null;
function getCopilotKnowledge() {
  if (_copilotKb) return _copilotKb;
  try {
    const file = path.join(__dirname, '..', 'config', 'knowledge', 'copilot.yaml');
    const data = yaml.load(fs.readFileSync(file, 'utf8'));
    _copilotKb = (data.entries || []).map(e => `• ${e.title}: ${e.content.trim()}`).join('\n\n');
  } catch (e) {
    logger.warn('Could not load copilot.yaml:', e.message);
    _copilotKb = '';
  }
  return _copilotKb;
}

// Role → tools they can access
const ROLE_TOOLS = {
  admin:     ['Agatha', 'Bran Mecano', 'Optimus'],
  bu:        ['Agatha', 'Bran Mecano', 'Optimus'],
  boostic:   ['Agatha', 'Bran Mecano'],
  binnacle:  ['Agatha', 'Bran Mecano'],
  tech:      ['Agatha', 'Optimus'],
  business:  ['Agatha', 'Bran Mecano', 'Optimus'],
  comercial: ['Agatha', 'Bran Mecano'],
};

const COPILOT_PROMPT = `Eres Sarah, la asistente interna de Redegal para el ecosistema de herramientas internas.
Estás integrada en Agatha, la plataforma de contact intelligence de Redegal.

ROL DEL USUARIO: {{role}}
HERRAMIENTAS DISPONIBLES PARA ESTE ROL: {{tools}}

Tu función es ayudar al equipo interno de Redegal con:
- Cómo usar Agatha (búsqueda de contactos, AI Finder, importación, envío a Bran)
- Cómo funciona Bran Mecano (pipeline, scoring, outreach, revisión de leads)
- Cómo usar Optimus (generar propuestas comerciales con IA)
- Conocimiento corporativo de Redegal (servicios, líneas de negocio, datos empresa)

REGLAS:
1. Responde SOLO sobre las herramientas disponibles para el rol del usuario y el conocimiento de Redegal.
2. NO ayudes con temas de leads externos ni con captación de clientes desde esta interfaz — eso es función de Bran Mecano.
3. Si te preguntan por una herramienta que no tiene acceso el rol, indícalo amablemente.
4. Sé conciso y directo. El usuario es del equipo interno, no un cliente externo.
5. Usa bullet points y markdown cuando sea útil.
6. Si no sabes algo específico, di que consultará con el equipo técnico.

BASE DE CONOCIMIENTO INTERNA:
{{knowledge}}`;

async function generateCopilotResponse({ message, role, conversationHistory }) {
  const tools = ROLE_TOOLS[role] || ROLE_TOOLS.admin;
  const kb = getCopilotKnowledge();

  // Also vector-search the copilot knowledge
  let vectorKb = '';
  try {
    const vectorResults = await vectorSearchKnowledge(message, null, 3, 'es');
    if (vectorResults.length > 0) {
      vectorKb = '\n\nCONTEXTO ADICIONAL (búsqueda semántica):\n' +
        vectorResults.map(r => `• ${r.title}: ${r.content}`).join('\n');
    }
  } catch (e) {
    logger.debug('Vector search unavailable for copilot:', e.message);
  }

  const systemPrompt = COPILOT_PROMPT
    .replace('{{role}}', role || 'admin')
    .replace('{{tools}}', tools.join(', '))
    .replace('{{knowledge}}', kb + vectorKb);

  const historyText = (conversationHistory || [])
    .slice(-6)
    .map(m => `${m.sender === 'visitor' ? 'Usuario' : 'Sarah'}: ${m.content}`)
    .join('\n');

  const userPrompt = historyText
    ? `Historial reciente:\n${historyText}\n\nMensaje: ${message}`
    : message;

  const response = await aiComplete(systemPrompt, userPrompt);
  return { response, detectedLine: 'copilot' };
}

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

const LANGUAGE_NAMES = { es: 'español', gl: 'gallego', en: 'inglés', pt: 'portugués', de: 'alemán', it: 'italiano' };

async function generateResponse({ message, language, businessLine, conversationHistory, role }) {
  // Copilot mode: internal tool assistant for Agatha users
  // language may be 'es-copilot' or 'es-copilot-{role}'
  if (language && language.startsWith('es-copilot')) {
    const langRole = language.replace('es-copilot-', '').replace('es-copilot', '') || 'admin';
    return generateCopilotResponse({ message, role: langRole || role || businessLine || 'admin', conversationHistory });
  }
  const line = businessLine || detectBusinessLine(message) || 'general';
  const context = getContextForLine(line);

  // Full-text search (existing)
  const kbResults = await searchKnowledge(message, line === 'general' ? null : line, language);
  const extraKb = kbResults.map((r) => `- ${r.title}: ${r.content || ''}`).join('\n');

  // RAG: vector search on knowledge base
  let vectorKb = '';
  try {
    const vectorResults = await vectorSearchKnowledge(message, line === 'general' ? null : line, 3, language);
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
  // Always available — no business hours restriction
  return true;
}

module.exports = { generateResponse, detectBusinessLine, isBusinessHours, BUSINESS_LINES };
