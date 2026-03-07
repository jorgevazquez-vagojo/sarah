/**
 * Learning service — feedback loop + auto-learning from CSAT and agent reviews.
 *
 * 1. Stores every bot response as a candidate for review
 * 2. Auto-learns from conversations with CSAT >= 4
 * 3. Processes agent feedback (good/bad/corrected)
 * 4. Feeds learned responses back into RAG context
 */

const { logger } = require('../utils/logger');
const { db } = require('../utils/db');
const { generateEmbedding } = require('./embeddings');
const { learnFromInteraction } = require('./rag-learn');

const CSAT_AUTO_LEARN_THRESHOLD = 4; // CSAT 4 or 5 → auto-learn

// ─── Record a bot response for potential learning ───
async function recordBotResponse({ conversationId, messageId, visitorMessage, aiResponse, provider, businessLine, language }) {
  try {
    await db.query(
      `INSERT INTO response_feedback (conversation_id, message_id, visitor_message, ai_response, ai_provider, business_line, language)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [conversationId, messageId, visitorMessage, aiResponse, provider, businessLine, language]
    );
  } catch (e) {
    logger.warn('Failed to record bot response for learning:', e.message);
  }
}

// ─── Process CSAT submission → auto-learn if rating is high ───
async function processCSATForLearning(conversationId, rating) {
  if (rating < CSAT_AUTO_LEARN_THRESHOLD) return;

  try {
    // Get all unreviewed bot responses from this conversation
    const { rows } = await db.query(
      `SELECT id, visitor_message, ai_response, business_line, language
       FROM response_feedback
       WHERE conversation_id = $1 AND reviewed_at IS NULL`,
      [conversationId]
    );

    for (const row of rows) {
      // Mark as auto-learned with good feedback
      await db.query(
        `UPDATE response_feedback SET feedback = 'good', auto_learned = true, csat_rating = $2, reviewed_at = NOW()
         WHERE id = $1`,
        [row.id, rating]
      );

      // Create learned response (local pgvector)
      await learnResponse({
        feedbackId: row.id,
        visitorPattern: row.visitor_message,
        idealResponse: row.ai_response,
        businessLine: row.business_line,
        language: row.language,
        confidence: rating >= 5 ? 0.9 : 0.7,
      });

      // Deposit in central RAG — only validated responses reach here (CSAT >= 4)
      learnFromInteraction({
        question: row.visitor_message,
        answer: row.ai_response,
        businessLine: row.business_line || '*',
        language: row.language || 'es',
        audience: 'lead',
        minLength: 80,
      });
    }

    logger.info(`Auto-learned ${rows.length} responses from CSAT ${rating} (conv: ${conversationId})`);
  } catch (e) {
    logger.warn('CSAT auto-learning failed:', e.message);
  }
}

// ─── Agent marks a response as good/bad ───
async function submitFeedback({ feedbackId, feedback, correctedResponse, notes, agentId }) {
  try {
    await db.query(
      `UPDATE response_feedback SET feedback = $2, corrected_response = $3, notes = $4, reviewed_by = $5, reviewed_at = NOW()
       WHERE id = $1`,
      [feedbackId, feedback, correctedResponse || null, notes || null, agentId]
    );

    // If marked as good (or corrected), learn from it
    if (feedback === 'good' || correctedResponse) {
      const { rows } = await db.query(
        `SELECT visitor_message, ai_response, business_line, language FROM response_feedback WHERE id = $1`,
        [feedbackId]
      );
      if (rows[0]) {
        const idealResponse = correctedResponse || rows[0].ai_response;
        await learnResponse({
          feedbackId,
          visitorPattern: rows[0].visitor_message,
          idealResponse,
          businessLine: rows[0].business_line,
          language: rows[0].language,
          confidence: correctedResponse ? 0.95 : 0.85,
        });

        // Agent-validated response → deposit in central RAG
        learnFromInteraction({
          question: rows[0].visitor_message,
          answer: idealResponse,
          businessLine: rows[0].business_line || '*',
          language: rows[0].language || 'es',
          audience: 'lead',
          minLength: 80,
        });
      }
    }

    return true;
  } catch (e) {
    logger.error('Submit feedback failed:', e.message);
    return false;
  }
}

// ─── Core: create a learned response with embedding ───
async function learnResponse({ feedbackId, visitorPattern, idealResponse, businessLine, language, confidence }) {
  try {
    const embedding = await generateEmbedding(visitorPattern + ' ' + idealResponse);
    const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;

    await db.query(
      `INSERT INTO learned_responses (source_feedback_id, visitor_pattern, ideal_response, business_line, language, embedding, confidence)
       VALUES ($1, $2, $3, $4, $5, $6::vector, $7)
       ON CONFLICT DO NOTHING`,
      [feedbackId, visitorPattern, idealResponse, businessLine, language || 'es', embeddingStr, confidence]
    );

    logger.info(`Learned response (confidence: ${confidence}, line: ${businessLine})`);
  } catch (e) {
    logger.warn('Failed to create learned response:', e.message);
  }
}

// ─── RAG: find relevant learned responses for a query ───
async function findLearnedResponses(query, businessLine, limit = 3) {
  try {
    const embedding = await generateEmbedding(query);
    if (!embedding) return [];

    const embeddingStr = `[${embedding.join(',')}]`;
    const { rows } = await db.query(
      `SELECT visitor_pattern, ideal_response, confidence,
              1 - (embedding <=> $1::vector) AS similarity
       FROM learned_responses
       WHERE is_active = true
         AND ($2::text IS NULL OR business_line = $2)
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [embeddingStr, businessLine || null, limit]
    );

    // Only return results above similarity threshold
    return rows.filter((r) => r.similarity > 0.6);
  } catch (e) {
    logger.warn('Learned response search failed:', e.message);
    return [];
  }
}

// ─── Get training stats ───
async function getTrainingStats() {
  try {
    const { rows } = await db.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE feedback = 'good') AS good_count,
        COUNT(*) FILTER (WHERE feedback = 'bad') AS bad_count,
        COUNT(*) FILTER (WHERE reviewed_at IS NULL) AS pending_count,
        COUNT(*) FILTER (WHERE auto_learned = true) AS auto_learned_count
      FROM response_feedback
    `);
    const { rows: learnedRows } = await db.query(`
      SELECT COUNT(*) AS total, AVG(confidence) AS avg_confidence
      FROM learned_responses WHERE is_active = true
    `);
    return {
      ...rows[0],
      learned_total: learnedRows[0]?.total || 0,
      learned_avg_confidence: parseFloat(learnedRows[0]?.avg_confidence || 0).toFixed(2),
    };
  } catch (e) {
    logger.warn('Training stats failed:', e.message);
    return { total: 0, good_count: 0, bad_count: 0, pending_count: 0, auto_learned_count: 0, learned_total: 0, learned_avg_confidence: 0 };
  }
}

// ─── Get responses for review (paginated) ───
async function getResponsesForReview({ feedback, businessLine, language, limit = 20, offset = 0 } = {}) {
  const conds = [];
  const vals = [];
  let i = 1;

  if (feedback === 'pending') {
    conds.push(`rf.reviewed_at IS NULL`);
  } else if (feedback) {
    conds.push(`rf.feedback = $${i++}`);
    vals.push(feedback);
  }
  if (businessLine) { conds.push(`rf.business_line = $${i++}`); vals.push(businessLine); }
  if (language) { conds.push(`rf.language = $${i++}`); vals.push(language); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  vals.push(limit, offset);

  const { rows } = await db.query(
    `SELECT rf.*, a.display_name AS reviewer_name
     FROM response_feedback rf
     LEFT JOIN agents a ON rf.reviewed_by = a.id
     ${where}
     ORDER BY rf.created_at DESC
     LIMIT $${i++} OFFSET $${i}`,
    vals
  );
  return rows;
}

module.exports = {
  recordBotResponse,
  processCSATForLearning,
  submitFeedback,
  findLearnedResponses,
  getTrainingStats,
  getResponsesForReview,
};
