const { db } = require('../utils/db');

async function getAnalyticsStats({ from, to } = {}) {
  const dateFilter = from && to
    ? `AND created_at BETWEEN '${from}' AND '${to}'`
    : `AND created_at > NOW() - INTERVAL '30 days'`;

  const [convs, leads, csat, byLine, byLang] = await Promise.all([
    db.query(`SELECT COUNT(*) FROM conversations WHERE 1=1 ${dateFilter.replace('created_at', 'started_at')}`),
    db.query(`SELECT COUNT(*) FROM leads WHERE 1=1 ${dateFilter}`),
    db.query(`SELECT AVG((data->>'rating')::numeric) AS avg_rating FROM analytics_events WHERE event_type = 'csat' ${dateFilter}`),
    db.query(`SELECT business_line, COUNT(*) FROM conversations WHERE business_line IS NOT NULL ${dateFilter.replace('created_at', 'started_at')} GROUP BY business_line`),
    db.query(`SELECT language, COUNT(*) FROM conversations WHERE 1=1 ${dateFilter.replace('created_at', 'started_at')} GROUP BY language`),
  ]);

  return {
    totalConversations: parseInt(convs.rows[0].count),
    totalLeads: parseInt(leads.rows[0].count),
    avgResponseTime: 0, // TODO: calculate from message timestamps
    csatAvg: parseFloat(csat.rows[0].avg_rating) || 0,
    byBusinessLine: Object.fromEntries(byLine.rows.map((r) => [r.business_line, parseInt(r.count)])),
    byLanguage: Object.fromEntries(byLang.rows.map((r) => [r.language, parseInt(r.count)])),
  };
}

module.exports = { getAnalyticsStats };
