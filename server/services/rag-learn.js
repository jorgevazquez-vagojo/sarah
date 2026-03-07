/**
 * RAG central learning client.
 *
 * Sends LLM-generated knowledge fragments to rag-service /v1/learn so they
 * are indexed and available for future retrieval by all services.
 *
 * Usage:
 *   await learnFromInteraction({ question, answer, businessLine, language });
 */

const { logger } = require('../utils/logger');

const RAG_URL = process.env.RAG_SERVICE_URL;
const RAG_KEY = process.env.RAG_SERVICE_KEY;

/**
 * Submit a Q&A pair to the central RAG for indexing.
 * Fire-and-forget: errors are logged but never propagate to the caller.
 *
 * @param {object} opts
 * @param {string} [opts.question]       - Visitor question or topic
 * @param {string}  opts.answer          - LLM response (the valuable content)
 * @param {string} [opts.context]        - Extra context (system prompt excerpt, etc.)
 * @param {string} [opts.businessLine]   - "boostic" | "binnacle" | "marketing" | "tech" | "*"
 * @param {string} [opts.language]       - "es" | "en" | "de" | "it" | "pt" | "gl"
 * @param {string} [opts.audience]       - "lead" | "commercial" | "*" (default: "commercial")
 * @param {number} [opts.minLength=100]  - Don't send if answer shorter than this
 */
async function learnFromInteraction({ question, answer, context, businessLine, language, audience, minLength = 100 } = {}) {
  if (!RAG_URL || !RAG_KEY) return; // not configured

  const text = (answer || '').trim();
  if (text.length < minLength) return; // too short to be useful

  try {
    const res = await fetch(`${RAG_URL}/v1/learn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Rag-Key': RAG_KEY,
      },
      body: JSON.stringify({
        question: question || null,
        answer: text,
        context: context || null,
        service: 'sarah',
        audience: audience || 'commercial',
        businessLine: businessLine || '*',
        language: language || 'es',
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      logger.warn(`[rag-learn] /v1/learn responded ${res.status}`);
    } else {
      logger.debug(`[rag-learn] Knowledge ingested (${text.length} chars, ${businessLine || '*'})`);
    }
  } catch (e) {
    logger.warn(`[rag-learn] Failed to send knowledge to RAG: ${e.message}`);
  }
}

module.exports = { learnFromInteraction };
