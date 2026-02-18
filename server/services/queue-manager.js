const { db } = require('../utils/db');
const { redis } = require('../utils/redis');
const { logger } = require('../utils/logger');

const QUEUE_MAP = {
  boostic:   'queue-boostic',
  binnacle:  'queue-binnacle',
  marketing: 'queue-marketing',
  tech:      'queue-tech',
};

async function findBestAgent({ language, businessLine }) {
  const agents = await db.getAvailableAgents({ language, businessLine });

  if (agents.length === 0) {
    // Fallback: try any available agent
    const fallback = await db.getAvailableAgents();
    return fallback[0] || null;
  }

  // Prefer agent with matching language AND business line
  const perfect = agents.find(
    (a) => a.languages.includes(language) && a.business_lines.includes(businessLine)
  );
  if (perfect) return perfect;

  // Then language match
  const langMatch = agents.find((a) => a.languages.includes(language));
  if (langMatch) return langMatch;

  return agents[0];
}

function getQueueName(businessLine) {
  return QUEUE_MAP[businessLine] || 'queue-general';
}

async function getQueueStats() {
  const stats = {};
  for (const [line, queue] of Object.entries(QUEUE_MAP)) {
    const waiting = await db.query(
      `SELECT COUNT(*) FROM conversations WHERE state = 'chat_waiting_agent' AND business_line = $1`,
      [line]
    );
    const active = await db.query(
      `SELECT COUNT(*) FROM conversations WHERE state = 'chat_active' AND agent_id IS NOT NULL AND business_line = $1`,
      [line]
    );
    stats[line] = {
      queue,
      waiting: parseInt(waiting.rows[0].count),
      active: parseInt(active.rows[0].count),
    };
  }
  return stats;
}

module.exports = { findBestAgent, getQueueName, getQueueStats };
