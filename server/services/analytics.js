const db = require('../utils/db');
const redis = require('../utils/redis');

async function getAnalytics(tenantId, period = '7d') {
  const query = `
    SELECT
      DATE(created_at) as date,
      COUNT(*) as conversations,
      COUNT(DISTINCT user_id) as unique_visitors,
      COUNT(CASE WHEN lead_id IS NOT NULL THEN 1 END) as leads,
      COUNT(CASE WHEN agent_id IS NOT NULL THEN 1 END) as escalations,
      ROUND(AVG(CASE WHEN csat_score IS NOT NULL THEN csat_score END), 2) as avg_csat,
      STRING_AGG(DISTINCT intent, ', ') as top_intents
    FROM conversations
    WHERE tenant_id = $1
      AND created_at > NOW() - INTERVAL $2
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `;

  return db.query(query, [tenantId, period]);
}

async function getFunnelMetrics(tenantId) {
  const query = `
    SELECT
      COUNT(DISTINCT session_id) as visitors,
      COUNT(DISTINCT CASE WHEN message_count > 0 THEN session_id END) as engaged,
      COUNT(DISTINCT CASE WHEN lead_id IS NOT NULL THEN session_id END) as converted,
      COUNT(DISTINCT CASE WHEN agent_id IS NOT NULL THEN session_id END) as escalated
    FROM conversations
    WHERE tenant_id = $1
      AND created_at > NOW() - INTERVAL '30 days'
  `;

  const result = await db.query(query, [tenantId]);
  const row = result.rows[0];

  return {
    funnel: {
      visitors: row.visitors,
      engaged: row.engaged,
      engaged_rate: ((row.engaged / row.visitors) * 100).toFixed(2) + '%',
      converted: row.converted,
      conversion_rate: ((row.converted / row.visitors) * 100).toFixed(2) + '%',
      escalated: row.escalated,
      escalation_rate: ((row.escalated / row.visitors) * 100).toFixed(2) + '%',
    },
  };
}

module.exports = { getAnalytics, getFunnelMetrics };
