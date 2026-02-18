const { aiComplete } = require('./ai');
const { db } = require('../utils/db');
const { logger } = require('../utils/logger');

const SUGGESTION_PROMPT = `Eres un asistente de soporte de Redegal. Analiza la conversación y genera exactamente 3 respuestas sugeridas que el agente podría enviar al visitante.

Reglas:
- Cada respuesta debe ser concisa (1-2 frases)
- Responde en el mismo idioma que usa el visitante
- Una respuesta debe ser informativa, otra empática, y otra con acción concreta
- Formato: devuelve solo las 3 opciones separadas por |||
- No incluyas numeración, viñetas ni prefijos`;

async function generateSuggestedReplies(conversationId) {
  try {
    const messages = await db.getMessages(conversationId, 10);
    if (messages.length < 2) return [];

    const historyText = messages
      .filter((m) => m.sender !== 'system' && m.sender !== 'note')
      .slice(-8)
      .map((m) => {
        const role = m.sender === 'visitor' ? 'Visitante' : m.sender === 'agent' ? 'Agente' : 'Bot';
        return `${role}: ${m.content}`;
      })
      .join('\n');

    const result = await aiComplete(
      SUGGESTION_PROMPT,
      `Conversación:\n\n${historyText}\n\nGenera 3 respuestas sugeridas para el agente:`,
      { maxTokens: 256, temperature: 0.6 }
    );

    if (!result) return [];

    const suggestions = result
      .split('|||')
      .map((s) => s.trim())
      .filter((s) => s.length > 5 && s.length < 300);

    return suggestions.slice(0, 3);
  } catch (e) {
    logger.warn('Failed to generate suggested replies:', e.message);
    return [];
  }
}

module.exports = { generateSuggestedReplies };
