/**
 * QueueUpdater — Periodic broadcast of queue position updates to waiting callers
 *
 * Every 15 seconds, iterates all active queues and sends each waiting visitor
 * a WebSocket message with their current position and estimated wait time.
 *
 * If the estimated wait exceeds 5 minutes, an additional long_wait message
 * is sent suggesting a callback option.
 *
 * The updater tags each chat WebSocket with its visitorId on connection,
 * so it can find the right socket for each queued caller without modifying
 * chat-handler.js. Both listeners (chat-handler and this module) fire on
 * the same wssChat 'connection' event — this is standard EventEmitter behavior.
 *
 * Usage (in index.js, AFTER initChatHandler):
 *   const { callQueue } = require('./services/call-queue');
 *   const { initQueueUpdater } = require('./services/queue-updater');
 *   initQueueUpdater(wssChat, callQueue);
 */

const { logger } = require('../utils/logger');
const { ALL_QUEUES, queueToBusinessLine } = require('./call-queue');

const UPDATE_INTERVAL_MS = 15000; // 15 seconds
const LONG_WAIT_THRESHOLD_SECONDS = 300; // 5 minutes

/**
 * Send a typed message to a WebSocket client if connected.
 * @param {WebSocket} ws
 * @param {string} type
 * @param {object} data
 */
function send(ws, type, data) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type, ...data }));
  }
}

/**
 * Find a visitor's WebSocket connection from the chat WSS.
 * Iterates wssChat.clients and matches ws._queueVisitorId.
 *
 * @param {WebSocketServer} wssChat
 * @param {string} visitorId
 * @returns {WebSocket|null}
 */
function findVisitorSocket(wssChat, visitorId) {
  for (const ws of wssChat.clients) {
    if (ws._queueVisitorId === visitorId && ws.readyState === 1) {
      return ws;
    }
  }
  return null;
}

/** @type {NodeJS.Timeout|null} */
let interval = null;

/**
 * Set of callerIds that have already received a long_wait message
 * (to avoid spamming the same message every 15 seconds).
 * Cleared when the caller is dequeued.
 * @type {Set<string>}
 */
const longWaitNotified = new Set();

/**
 * Initialize the queue position updater.
 *
 * Attaches a secondary connection listener to wssChat to tag each
 * socket with its visitorId, then starts the periodic broadcast loop.
 *
 * @param {WebSocketServer} wssChat - The chat WebSocket server (from index.js)
 * @param {object} callQueue - The callQueue service instance
 */
function initQueueUpdater(wssChat, callQueue) {
  if (interval) {
    clearInterval(interval);
  }

  // Tag each chat WebSocket with its visitorId so we can find it later.
  // This listener runs alongside chat-handler's own connection listener.
  wssChat.on('connection', (ws, req) => {
    try {
      const params = new URL(req.url, 'http://localhost').searchParams;
      const visitorId = params.get('visitorId');
      if (visitorId) {
        ws._queueVisitorId = visitorId;
      }
    } catch {
      // Non-critical: queue updates just won't reach this socket
    }
  });

  logger.info('QueueUpdater: Starting periodic updates every 15s');

  interval = setInterval(async () => {
    try {
      await broadcastUpdates(wssChat, callQueue);
    } catch (e) {
      logger.error('QueueUpdater: Broadcast error:', e.message);
    }
  }, UPDATE_INTERVAL_MS);

  // Don't prevent process exit
  interval.unref();
}

/**
 * Broadcast queue position updates to all waiting callers.
 *
 * @param {WebSocketServer} wssChat
 * @param {object} callQueue
 */
async function broadcastUpdates(wssChat, callQueue) {
  // Track active callerIds to clean up longWaitNotified
  const activeCallerIds = new Set();

  for (const queueName of ALL_QUEUES) {
    const size = await callQueue.getQueueSize(queueName);
    if (size === 0) continue;

    const members = await callQueue.getQueueMembers(queueName);
    const businessLine = queueToBusinessLine(queueName);
    const agentsOnline = await callQueue.getOnlineAgentCount(businessLine);

    for (let i = 0; i < members.length; i++) {
      const { callerId } = members[i];
      activeCallerIds.add(callerId);

      const position = i + 1; // 1-based
      const estimatedWait = await callQueue.getEstimatedWait(queueName, position);
      const estimatedWaitSeconds = await callQueue.getEstimatedWaitSeconds(queueName, position);

      // Find the visitor's WebSocket
      const ws = findVisitorSocket(wssChat, callerId);
      if (!ws) continue;

      // Send position update
      send(ws, 'queue_update', {
        position,
        estimatedWait,
        agentsOnline,
        queueName,
        queueSize: size,
      });

      // If wait exceeds threshold, send a one-time long_wait notification
      if (estimatedWaitSeconds > LONG_WAIT_THRESHOLD_SECONDS && !longWaitNotified.has(callerId)) {
        longWaitNotified.add(callerId);
        send(ws, 'queue_long_wait', {
          message: 'La espera es mayor de lo habitual. Puedes seguir esperando o solicitar que te llamemos cuando haya un agente disponible.',
          estimatedWait,
          position,
        });
        logger.info(`QueueUpdater: Long wait notification sent to ${callerId} (pos ${position}, est. ${estimatedWait})`);
      }
    }
  }

  // Clean up long wait notifications for callers no longer in any queue
  for (const callerId of longWaitNotified) {
    if (!activeCallerIds.has(callerId)) {
      longWaitNotified.delete(callerId);
    }
  }
}

/**
 * Stop the updater (for graceful shutdown / tests).
 */
function stopQueueUpdater() {
  if (interval) {
    clearInterval(interval);
    interval = null;
    logger.info('QueueUpdater: Stopped');
  }
}

module.exports = { initQueueUpdater, stopQueueUpdater };
