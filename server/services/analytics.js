const { db } = require('../utils/db');

async function getAnalyticsStats({ from, to, tenantId } = {}) {
  // Parameterized date filtering to prevent SQL injection
  const hasDateRange = from && to;
  const params = [];
  let pIdx = 1;

  // Tenant filter (optional)
  let tenantFilter = '';
  let tenantFilterConv = '';
  let tenantFilterAnalytics = '';
  if (tenantId) {
    params.push(tenantId);
    tenantFilter = `AND tenant_id = $${pIdx}`;
    tenantFilterConv = `AND c.tenant_id = $${pIdx}`;
    tenantFilterAnalytics = `AND tenant_id = $${pIdx}`;
    pIdx++;
  }

  // Date params
  const dateParams = [];
  let startedFilter, createdFilter;
  if (hasDateRange) {
    params.push(from, to);
    startedFilter = `AND started_at BETWEEN $${pIdx} AND $${pIdx + 1}`;
    createdFilter = `AND created_at BETWEEN $${pIdx} AND $${pIdx + 1}`;
    dateParams.push(from, to);
    pIdx += 2;
  } else {
    startedFilter = "AND started_at > NOW() - INTERVAL '30 days'";
    createdFilter = "AND created_at > NOW() - INTERVAL '30 days'";
  }

  // Build param array for each query (tenant + date)
  const qParams = tenantId
    ? (hasDateRange ? [tenantId, from, to] : [tenantId])
    : (hasDateRange ? [from, to] : []);

  const [convs, leads, csat, byLine, byLang, avgResp, deflection, heatmap, agentPerf, leadFunnel] = await Promise.all([
    // Basic counts
    db.query(`SELECT COUNT(*) FROM conversations WHERE 1=1 ${tenantFilter} ${startedFilter}`, qParams),
    db.query(`SELECT COUNT(*) FROM leads WHERE 1=1 ${tenantFilter} ${createdFilter}`, qParams),
    db.query(`SELECT AVG((data->>'rating')::numeric) AS avg_rating FROM analytics_events WHERE event_type = 'csat' ${tenantFilterAnalytics} ${createdFilter}`, qParams),
    db.query(`SELECT business_line, COUNT(*) FROM conversations WHERE business_line IS NOT NULL ${tenantFilter} ${startedFilter} GROUP BY business_line`, qParams),
    db.query(`SELECT language, COUNT(*) FROM conversations WHERE 1=1 ${tenantFilter} ${startedFilter} GROUP BY language`, qParams),

    // Average response time (LATERAL JOIN)
    db.query(`
      SELECT AVG(response_seconds) AS avg_seconds FROM (
        SELECT EXTRACT(EPOCH FROM (reply.created_at - visitor_msg.created_at)) AS response_seconds
        FROM messages visitor_msg
        JOIN conversations conv ON conv.id = visitor_msg.conversation_id
        JOIN LATERAL (
          SELECT created_at FROM messages
          WHERE conversation_id = visitor_msg.conversation_id
            AND created_at > visitor_msg.created_at
            AND sender IN ('bot', 'agent')
          ORDER BY created_at ASC LIMIT 1
        ) reply ON true
        WHERE visitor_msg.sender = 'visitor'
          ${tenantId ? `AND conv.tenant_id = $1` : ''}
          ${hasDateRange
            ? `AND visitor_msg.created_at BETWEEN $${tenantId ? 2 : 1} AND $${tenantId ? 3 : 2}`
            : "AND visitor_msg.created_at > NOW() - INTERVAL '30 days'"
          }
      ) sub
      WHERE response_seconds > 0 AND response_seconds < 3600
    `, qParams),

    // Bot deflection rate: conversations resolved by bot (no agent, closed)
    db.query(`
      SELECT
        COUNT(*) FILTER (WHERE agent_id IS NULL AND state = 'closed') AS deflected,
        COUNT(*) FILTER (WHERE state = 'closed') AS total_closed,
        COUNT(*) AS total
      FROM conversations WHERE 1=1 ${tenantFilter} ${startedFilter}
    `, qParams),

    // Conversation volume heatmap (hour x day of week)
    db.query(`
      SELECT EXTRACT(HOUR FROM started_at) AS hour,
             EXTRACT(DOW FROM started_at) AS dow,
             COUNT(*)
      FROM conversations WHERE 1=1 ${tenantFilter} ${startedFilter}
      GROUP BY hour, dow ORDER BY dow, hour
    `, qParams),

    // Agent performance breakdown
    db.query(`
      SELECT a.display_name, a.id AS agent_id,
        COUNT(c.id) AS handled,
        AVG(EXTRACT(EPOCH FROM (COALESCE(c.closed_at, NOW()) - c.updated_at))) AS avg_handle_time_sec,
        AVG(ae.rating) AS avg_csat
      FROM conversations c
      JOIN agents a ON c.agent_id = a.id
      LEFT JOIN LATERAL (
        SELECT (data->>'rating')::numeric AS rating
        FROM analytics_events
        WHERE conversation_id = c.id AND event_type = 'csat'
        LIMIT 1
      ) ae ON true
      WHERE c.agent_id IS NOT NULL ${tenantFilterConv} ${startedFilter}
      GROUP BY a.id, a.display_name
      ORDER BY handled DESC
    `, qParams),

    // Lead conversion funnel
    db.query(`
      SELECT
        COUNT(DISTINCT c.id) AS total_conversations,
        COUNT(DISTINCT l.id) AS leads_captured,
        COUNT(DISTINCT l.id) FILTER (WHERE l.quality_score >= 60) AS qualified_leads,
        COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'converted') AS converted_leads
      FROM conversations c
      LEFT JOIN leads l ON l.conversation_id = c.id
      WHERE 1=1 ${tenantFilterConv} ${startedFilter}
    `, qParams),
  ]);

  // Build heatmap grid
  const heatmapData = {};
  for (const row of heatmap.rows) {
    const key = `${Math.round(row.dow)}-${Math.round(row.hour)}`;
    heatmapData[key] = parseInt(row.count);
  }

  const deflectionRow = deflection.rows[0];
  const totalClosed = parseInt(deflectionRow.total_closed) || 0;
  const deflectionRate = totalClosed > 0
    ? Math.round((parseInt(deflectionRow.deflected) / totalClosed) * 100)
    : 0;

  const funnel = leadFunnel.rows[0] || {};

  return {
    totalConversations: parseInt(convs.rows[0].count),
    totalLeads: parseInt(leads.rows[0].count),
    avgResponseTime: Math.round(parseFloat(avgResp.rows[0].avg_seconds) || 0),
    csatAvg: parseFloat(csat.rows[0].avg_rating) || 0,
    byBusinessLine: Object.fromEntries(byLine.rows.map((r) => [r.business_line, parseInt(r.count)])),
    byLanguage: Object.fromEntries(byLang.rows.map((r) => [r.language, parseInt(r.count)])),

    // New enterprise metrics
    deflectionRate,
    heatmap: heatmapData,
    agentPerformance: agentPerf.rows.map((r) => ({
      agentId: r.agent_id,
      name: r.display_name,
      handled: parseInt(r.handled),
      avgHandleTimeSec: Math.round(parseFloat(r.avg_handle_time_sec) || 0),
      avgCsat: parseFloat(r.avg_csat) || null,
    })),
    leadFunnel: {
      conversations: parseInt(funnel.total_conversations) || 0,
      leads: parseInt(funnel.leads_captured) || 0,
      qualified: parseInt(funnel.qualified_leads) || 0,
      converted: parseInt(funnel.converted_leads) || 0,
    },
  };
}

module.exports = { getAnalyticsStats };
