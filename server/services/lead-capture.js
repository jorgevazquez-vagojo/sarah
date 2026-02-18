const { db } = require('../utils/db');
const { logger } = require('../utils/logger');

// Scoring weights
const SCORING = {
  hasEmail: 20,
  hasPhone: 10,
  hasCompany: 15,
  hasBusinessLine: 10,
  messageCount: 2,    // per message, max 20
  escalated: 15,
  calledVoip: 10,
};

async function scoreLead(leadId) {
  const lead = await db.query('SELECT * FROM leads WHERE id = $1', [leadId]);
  if (!lead.rows[0]) return 0;

  const l = lead.rows[0];
  let score = 0;

  if (l.email) score += SCORING.hasEmail;
  if (l.phone) score += SCORING.hasPhone;
  if (l.company) score += SCORING.hasCompany;
  if (l.business_line) score += SCORING.hasBusinessLine;

  // Count messages in conversation
  if (l.conversation_id) {
    const msgCount = await db.query(
      'SELECT COUNT(*) FROM messages WHERE conversation_id = $1 AND sender = $2',
      [l.conversation_id, 'visitor']
    );
    score += Math.min(parseInt(msgCount.rows[0].count) * SCORING.messageCount, 20);

    // Check if escalated
    const conv = await db.getConversation(l.conversation_id);
    if (conv?.agent_id) score += SCORING.escalated;

    // Check if VoIP call happened
    const callCount = await db.query(
      'SELECT COUNT(*) FROM calls WHERE conversation_id = $1',
      [l.conversation_id]
    );
    if (parseInt(callCount.rows[0].count) > 0) score += SCORING.calledVoip;
  }

  score = Math.min(score, 100);
  await db.updateLead(leadId, { quality_score: score });
  logger.info(`Lead ${leadId} scored: ${score}`);
  return score;
}

module.exports = { scoreLead };
