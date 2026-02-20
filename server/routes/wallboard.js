/**
 * Wallboard API — Real-time contact center metrics for TV/wallboard display
 *
 * GET /api/wallboard — Returns complete wallboard state (agent auth required)
 *
 * Aggregates data from:
 *   - call-queue.js (queue stats, agent counts)
 *   - PostgreSQL (today's calls, chats, leads, CSAT, callbacks)
 *   - Redis (agent states)
 */

const { Router } = require('express');
const { requireAgent } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/error-handler');
const { callQueue, ALL_QUEUES, queueToBusinessLine } = require('../services/call-queue');
const { db } = require('../utils/db');
const { redis } = require('../utils/redis');
const { logger } = require('../utils/logger');

const router = Router();

/** Business line metadata for wallboard display */
const BU_META = {
  boostic: { label: 'Boostic — SEO & Growth', emoji: '☀️', color: '#10B981' },
  binnacle: { label: 'Binnacle — BI & Analytics', emoji: '📊', color: '#6366F1' },
  marketing: { label: 'Marketing — Digital Marketing', emoji: '📣', color: '#F59E0B' },
  tech: { label: 'Tech — Development', emoji: '⚙️', color: '#3B82F6' },
  general: { label: 'General', emoji: '🔵', color: '#94A3B8' },
};

/** SLA target: percentage of calls/chats answered within threshold */
const SLA_TARGET = parseInt(process.env.SLA_TARGET || '80', 10);
const SLA_THRESHOLD_SECONDS = parseInt(process.env.SLA_THRESHOLD_SECONDS || '180', 10);

/**
 * Fetch today's aggregated stats from PostgreSQL.
 * All queries use `started_at >= (today midnight)` for conversations
 * and `created_at >= (today midnight)` for leads/events.
 */
async function getTodayStats() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const ts = todayStart.toISOString();

  const [calls, chats, leads, callbacks, csat, avgWait, avgCallDur, avgChatResp] = await Promise.all([
    // Call stats (from calls table)
    db.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'ended' AND answered_at IS NOT NULL) AS answered,
        COUNT(*) FILTER (WHERE status IN ('missed', 'failed')) AS missed
      FROM calls WHERE created_at >= $1
    `, [ts]),

    // Chat stats (from conversations table)
    db.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE state = 'closed') AS resolved,
        COUNT(*) FILTER (WHERE agent_id IS NOT NULL AND state != 'closed') AS escalated
      FROM conversations WHERE started_at >= $1
    `, [ts]),

    // Leads today
    db.query(`SELECT COUNT(*) FROM leads WHERE created_at >= $1`, [ts]),

    // Callbacks today
    db.query(`SELECT COUNT(*) FROM callbacks WHERE created_at >= $1`, [ts]),

    // Avg CSAT
    db.query(`
      SELECT AVG((data->>'rating')::numeric) AS avg_rating
      FROM analytics_events WHERE event_type = 'csat' AND created_at >= $1
    `, [ts]),

    // Avg wait time (seconds between conversation created and agent assignment)
    db.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (updated_at - started_at))) AS avg_sec
      FROM conversations
      WHERE agent_id IS NOT NULL AND started_at >= $1
    `, [ts]),

    // Avg call duration
    db.query(`
      SELECT AVG(duration_seconds) AS avg_sec
      FROM calls WHERE status = 'ended' AND duration_seconds > 0 AND created_at >= $1
    `, [ts]),

    // Avg chat first response time
    db.query(`
      SELECT AVG(response_seconds) AS avg_sec FROM (
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
          AND visitor_msg.created_at >= $1
      ) sub
      WHERE response_seconds > 0 AND response_seconds < 3600
    `, [ts]),
  ]);

  const callRow = calls.rows[0] || {};
  const chatRow = chats.rows[0] || {};
  const totalConvs = parseInt(chatRow.total) || 0;
  const leadsCount = parseInt(leads.rows[0]?.count) || 0;

  return {
    totalCalls: parseInt(callRow.total) || 0,
    answeredCalls: parseInt(callRow.answered) || 0,
    missedCalls: parseInt(callRow.missed) || 0,
    totalChats: totalConvs,
    resolvedChats: parseInt(chatRow.resolved) || 0,
    escalatedChats: parseInt(chatRow.escalated) || 0,
    leads: leadsCount,
    callbacks: parseInt(callbacks.rows[0]?.count) || 0,
    avgCsat: parseFloat(csat.rows[0]?.avg_rating) || 0,
    avgWaitTime: Math.round(parseFloat(avgWait.rows[0]?.avg_sec) || 0),
    avgCallDuration: Math.round(parseFloat(avgCallDur.rows[0]?.avg_sec) || 0),
    avgChatResponseTime: Math.round(parseFloat(avgChatResp.rows[0]?.avg_sec) || 0),
    conversionRate: totalConvs > 0 ? parseFloat(((leadsCount / totalConvs) * 100).toFixed(1)) : 0,
  };
}

/**
 * Fetch agent statuses with today's activity counts.
 */
async function getAgentStates() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const ts = todayStart.toISOString();

  const result = await db.query(`
    SELECT
      a.id, a.display_name, a.status, a.business_lines, a.last_seen_at,
      (SELECT COUNT(*) FROM calls c WHERE c.agent_id = a.id AND c.created_at >= $1) AS today_calls,
      (SELECT COUNT(*) FROM conversations c WHERE c.agent_id = a.id AND c.started_at >= $1) AS today_chats,
      (SELECT AVG((ae.data->>'rating')::numeric) FROM analytics_events ae WHERE ae.agent_id = a.id AND ae.event_type = 'csat' AND ae.created_at >= $1) AS avg_csat
    FROM agents a
    WHERE a.status != 'offline' OR a.last_seen_at >= $1
    ORDER BY
      CASE a.status WHEN 'online' THEN 1 WHEN 'busy' THEN 2 WHEN 'away' THEN 3 ELSE 4 END,
      a.display_name
  `, [ts]);

  // Enrich with current call info from active calls
  const agents = [];
  for (const row of result.rows) {
    const agent = {
      id: row.id,
      name: row.display_name,
      status: row.status,
      businessLine: (row.business_lines && row.business_lines[0]) || 'general',
      businessLines: row.business_lines || [],
      currentCall: null,
      avgCsat: parseFloat(row.avg_csat) || 0,
      todayCalls: parseInt(row.today_calls) || 0,
      todayChats: parseInt(row.today_chats) || 0,
    };

    // Check for active call
    if (row.status === 'busy') {
      try {
        const activeCall = await db.query(
          `SELECT call_id, created_at, duration_seconds FROM calls
           WHERE agent_id = $1 AND status = 'active'
           ORDER BY created_at DESC LIMIT 1`,
          [row.id]
        );
        if (activeCall.rows[0]) {
          const callStart = new Date(activeCall.rows[0].created_at);
          agent.currentCall = {
            callId: activeCall.rows[0].call_id,
            duration: Math.round((Date.now() - callStart.getTime()) / 1000),
          };
          agent.status = 'on_call';
        }
      } catch (e) {
        // Non-critical: skip
      }
    }

    agents.push(agent);
  }

  return agents;
}

/**
 * Calculate SLA percentage for today.
 * SLA = (conversations answered within threshold / total conversations) * 100
 */
async function calculateSLA() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const ts = todayStart.toISOString();

  try {
    const result = await db.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE agent_id IS NOT NULL
          AND EXTRACT(EPOCH FROM (updated_at - started_at)) <= $2
        ) AS within_sla
      FROM conversations
      WHERE started_at >= $1 AND state IN ('chat_waiting_agent', 'chat_active', 'closed')
    `, [ts, SLA_THRESHOLD_SECONDS]);

    const row = result.rows[0];
    const total = parseInt(row.total) || 0;
    if (total === 0) return SLA_TARGET; // No data yet, show target as default
    return Math.round((parseInt(row.within_sla) / total) * 100);
  } catch (e) {
    logger.warn('SLA calculation error:', e.message);
    return SLA_TARGET;
  }
}

/**
 * Generate alerts based on current state.
 */
function generateAlerts(queueStats, slaPercent) {
  const alerts = [];
  const now = new Date().toISOString();

  for (const [queueName, stats] of Object.entries(queueStats)) {
    const bl = queueToBusinessLine(queueName);
    const meta = BU_META[bl] || BU_META.general;

    // Long wait alert
    if (stats.longestWaitSeconds > SLA_THRESHOLD_SECONDS) {
      alerts.push({
        level: 'danger',
        message: `Cola ${meta.label}: espera > ${Math.round(SLA_THRESHOLD_SECONDS / 60)} min (SLA en riesgo)`,
        queue: bl,
        timestamp: now,
      });
    } else if (stats.longestWaitSeconds > SLA_THRESHOLD_SECONDS * 0.7) {
      alerts.push({
        level: 'warning',
        message: `Cola ${meta.label}: espera cercana al limite SLA`,
        queue: bl,
        timestamp: now,
      });
    }

    // No agents online for queue with waiters
    if (stats.waiting > 0 && stats.agentsOnline === 0) {
      alerts.push({
        level: 'danger',
        message: `Cola ${meta.label}: ${stats.waiting} en espera, 0 agentes online`,
        queue: bl,
        timestamp: now,
      });
    }
  }

  // Global SLA alert
  if (slaPercent < SLA_TARGET) {
    alerts.push({
      level: 'danger',
      message: `SLA global ${slaPercent}% por debajo del objetivo ${SLA_TARGET}%`,
      queue: 'global',
      timestamp: now,
    });
  }

  return alerts;
}

/**
 * Get hourly volume for the last 24 hours.
 */
async function getHourlyVolume() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const result = await db.query(`
      SELECT
        to_char(date_trunc('hour', started_at), 'HH24:00') AS hour,
        COUNT(*) FILTER (WHERE business_line IS NOT NULL) AS chats,
        0 AS calls
      FROM conversations
      WHERE started_at >= $1
      GROUP BY date_trunc('hour', started_at)
      ORDER BY date_trunc('hour', started_at)
    `, [yesterday]);

    // Also get call volume
    const callResult = await db.query(`
      SELECT
        to_char(date_trunc('hour', created_at), 'HH24:00') AS hour,
        COUNT(*) AS calls
      FROM calls
      WHERE created_at >= $1
      GROUP BY date_trunc('hour', created_at)
      ORDER BY date_trunc('hour', created_at)
    `, [yesterday]);

    // Merge into a map
    const hourMap = {};
    for (const row of result.rows) {
      hourMap[row.hour] = { hour: row.hour, calls: 0, chats: parseInt(row.chats) || 0 };
    }
    for (const row of callResult.rows) {
      if (!hourMap[row.hour]) {
        hourMap[row.hour] = { hour: row.hour, calls: 0, chats: 0 };
      }
      hourMap[row.hour].calls = parseInt(row.calls) || 0;
    }

    // Fill gaps for the last 24 hours
    const hours = [];
    for (let i = 23; i >= 0; i--) {
      const d = new Date(Date.now() - i * 60 * 60 * 1000);
      const hh = d.getHours().toString().padStart(2, '0') + ':00';
      hours.push(hourMap[hh] || { hour: hh, calls: 0, chats: 0 });
    }

    return hours;
  } catch (e) {
    logger.warn('Hourly volume query error:', e.message);
    return [];
  }
}

// ─── Main wallboard endpoint ───
router.get('/', requireAgent, asyncRoute(async (_req, res) => {
  const [queueStats, todayStats, agents, slaPercent, hourlyVolume] = await Promise.all([
    callQueue.getAllQueueStats(),
    getTodayStats(),
    getAgentStates(),
    calculateSLA(),
    getHourlyVolume(),
  ]);

  // Build queue summary per business line
  const queues = [];
  const businessLines = ['boostic', 'binnacle', 'marketing', 'tech'];
  for (const bl of businessLines) {
    const queueName = `queue-${bl}`;
    const stats = queueStats[queueName] || { waiting: 0, agentsOnline: 0, avgCallDuration: 0, longestWaitSeconds: 0 };
    const meta = BU_META[bl] || BU_META.general;

    // Count active chats/calls for this BU
    const blAgents = agents.filter((a) => a.businessLines.includes(bl) || a.businessLine === bl);
    const activeCalls = blAgents.filter((a) => a.status === 'on_call').length;
    const activeChats = blAgents.filter((a) => a.status === 'busy' && !a.currentCall).length;

    queues.push({
      name: bl,
      label: meta.label,
      emoji: meta.emoji,
      color: meta.color,
      activeCalls,
      activeChats,
      inQueue: stats.waiting,
      agentsOnline: stats.agentsOnline,
      avgWaitTime: stats.longestWaitSeconds > 0 ? stats.longestWaitSeconds : 0,
      slaPercent: stats.waiting > 0 && stats.longestWaitSeconds > SLA_THRESHOLD_SECONDS ? Math.max(0, SLA_TARGET - 10) : SLA_TARGET,
    });
  }

  // Global metrics
  const totalInQueue = Object.values(queueStats).reduce((sum, q) => sum + q.waiting, 0);
  const agentsOnline = agents.filter((a) => a.status !== 'offline').length;
  const agentsTotal = agents.length;
  const activeCalls = agents.filter((a) => a.status === 'on_call').length;
  const activeChats = agents.filter((a) => a.status === 'busy' && !a.currentCall).length;

  const alerts = generateAlerts(queueStats, slaPercent);

  res.json({
    timestamp: new Date().toISOString(),
    global: {
      activeCalls,
      activeChats,
      inQueue: totalInQueue,
      agentsOnline,
      agentsTotal,
      slaPercent,
      slaTarget: SLA_TARGET,
      todayStats,
    },
    queues,
    agents,
    alerts,
    hourlyVolume,
  });
}));

module.exports = router;
