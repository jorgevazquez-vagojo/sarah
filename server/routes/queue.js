/**
 * Queue API — Real-time queue stats and management for agent dashboard
 *
 * GET  /api/queues              — All queue stats (agent auth)
 * GET  /api/queues/:name        — Specific queue details + members (agent auth)
 * POST /api/queues/:name/next   — Agent picks next caller from queue (agent auth)
 */

const { Router } = require('express');
const { requireAgent } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/error-handler');
const { callQueue, ALL_QUEUES, queueToBusinessLine } = require('../services/call-queue');
const { logger } = require('../utils/logger');

const router = Router();

// ─── All queue stats (agent auth) ───
router.get('/', requireAgent, asyncRoute(async (req, res) => {
  const stats = await callQueue.getAllQueueStats();
  res.json({
    queues: stats,
    totalWaiting: Object.values(stats).reduce((sum, q) => sum + q.waiting, 0),
    timestamp: new Date().toISOString(),
  });
}));

// ─── Specific queue details with members (agent auth) ───
router.get('/:name', requireAgent, asyncRoute(async (req, res) => {
  const queueName = req.params.name;

  // Validate queue name
  if (!ALL_QUEUES.includes(queueName)) {
    return res.status(404).json({ error: `Queue "${queueName}" not found. Valid queues: ${ALL_QUEUES.join(', ')}` });
  }

  const businessLine = queueToBusinessLine(queueName);
  const size = await callQueue.getQueueSize(queueName);
  const agentCount = await callQueue.getOnlineAgentCount(businessLine);
  const members = await callQueue.getQueueMembers(queueName);

  // Enrich members with position and estimated wait
  const enrichedMembers = [];
  for (let i = 0; i < members.length; i++) {
    const position = i + 1;
    const estimatedWait = await callQueue.getEstimatedWait(queueName, position);
    const waitingSince = members[i].score;
    const waitingSeconds = Math.round((Date.now() - waitingSince) / 1000);

    enrichedMembers.push({
      callerId: members[i].callerId,
      position,
      estimatedWait,
      waitingSeconds,
      waitingSince: new Date(waitingSince).toISOString(),
      metadata: members[i].metadata,
    });
  }

  res.json({
    queueName,
    businessLine,
    waiting: size,
    agentsOnline: agentCount,
    members: enrichedMembers,
    timestamp: new Date().toISOString(),
  });
}));

// ─── Agent picks next caller from queue (FIFO) ───
router.post('/:name/next', requireAgent, asyncRoute(async (req, res) => {
  const queueName = req.params.name;

  // Validate queue name
  if (!ALL_QUEUES.includes(queueName)) {
    return res.status(404).json({ error: `Queue "${queueName}" not found` });
  }

  const members = await callQueue.getQueueMembers(queueName);

  if (members.length === 0) {
    return res.status(404).json({ error: 'Queue is empty' });
  }

  // Get the first caller (FIFO — lowest score = earliest entry)
  const next = members[0];

  // Dequeue them
  await callQueue.dequeue(queueName, next.callerId);

  logger.info(`Queue: Agent ${req.agent.username} picked next caller ${next.callerId} from ${queueName}`);

  res.json({
    callerId: next.callerId,
    metadata: next.metadata,
    waitedSeconds: Math.round((Date.now() - next.score) / 1000),
    queueName,
    remainingInQueue: members.length - 1,
  });
}));

module.exports = router;
