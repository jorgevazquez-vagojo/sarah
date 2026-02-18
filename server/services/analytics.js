const { db } = require('../utils/db');

async function getAnalyticsStats({ from, to } = {}) {
  // Parameterized date filtering to prevent SQL injection
  const hasDateRange = from && to;
  const dateParams = hasDateRange ? [from, to] : [];
  const startedFilter = hasDateRange
    ? 'AND started_at BETWEEN $1 AND $2'
    : 'AND started_at > NOW() - INTERVAL \'30 days\'';
  const createdFilter = hasDateRange
    ? 'AND created_at BETWEEN $1 AND $2'
    : 'AND created_at > NOW() - INTERVAL \'30 days\'';

  const [convs, leads, csat, byLine, byLang, avgResp] = await Promise.all([
    db.query(`SELECT COUNT(*) FROM conversations WHERE 1=1 ${startedFilter}`, dateParams),
    db.query(`SELECT COUNT(*) FROM leads WHERE 1=1 ${createdFilter}`, dateParams),
    db.query(`SELECT AVG((data->>'rating')::numeric) AS avg_rating FROM analytics_events WHERE event_type = 'csat' ${createdFilter}`, dateParams),
    db.query(`SELECT business_line, COUNT(*) FROM conversations WHERE business_line IS NOT NULL ${startedFilter} GROUP BY business_line`, dateParams),
    db.query(`SELECT language, COUNT(*) FROM conversations WHERE 1=1 ${startedFilter} GROUP BY language`, dateParams),
    // Average response time: time between visitor message and next bot/agent reply
    db.query(`
      SELECT AVG(response_seconds) AS avg_seconds FROM (
        SELECT EXTRACT(EPOCH FROM (reply.created_at - visitor_msg.created_at)) AS response_seconds
        FROM messages visitor_msg
        JOIN LATERAL (
          SELECT created_at FROM messages
          WHERE conversation_id = visitor_msg.conversation_id
            AND created_at > visitor_msg.created_at
            AND sender IN ('bot', 'agent')
          ORDER BY created_at ASC LIMIT 1
        ) reply ON true
        WHERE visitor_msg.sender = 'visitor'
          ${createdFilter.replace('created_at', 'visitor_msg.created_at')}
      ) sub
      WHERE response_seconds > 0 AND response_seconds < 3600
    `, dateParams),
  ]);

  return {
    totalConversations: parseInt(convs.rows[0].count),
    totalLeads: parseInt(leads.rows[0].count),
    avgResponseTime: Math.round(parseFloat(avgResp.rows[0].avg_seconds) || 0),
    csatAvg: parseFloat(csat.rows[0].avg_rating) || 0,
    byBusinessLine: Object.fromEntries(byLine.rows.map((r) => [r.business_line, parseInt(r.count)])),
    byLanguage: Object.fromEntries(byLang.rows.map((r) => [r.language, parseInt(r.count)])),
  };
}

module.exports = { getAnalyticsStats };
