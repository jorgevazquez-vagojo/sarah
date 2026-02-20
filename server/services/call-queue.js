/**
 * CallQueue — Real-time queue position tracking with Redis
 *
 * Uses Redis sorted sets for O(log N) position lookups.
 * Each queue (per business line) is a separate sorted set.
 * Score = timestamp of entry (for FIFO ordering).
 *
 * ═══════════════════════════════════════════════════════════════
 * INTEGRATION INSTRUCTIONS
 * ═══════════════════════════════════════════════════════════════
 *
 * 1. In chat-handler.js — handleRequestCall():
 *    After the call is saved to DB and before sending call_queued/call_initiated:
 *
 *      const { callQueue } = require('../services/call-queue');
 *      const queueName = getQueueName(conv.business_line);
 *      const { position, estimatedWait } = await callQueue.enqueue(queueName, visitorId, {
 *        phone, conversationId: conv.id, businessLine: conv.business_line, callId
 *      });
 *
 *    Then include position/estimatedWait in the call_queued response:
 *      send(ws, 'call_queued', { callId, position, estimatedWait, message: t(lang, 'call_queued') });
 *
 *    On call answered (when agent accepts via accept_call in agent-handler):
 *      await callQueue.dequeue(queueName, visitorId);
 *
 *    On visitor disconnect (ws 'close' event) while in queue:
 *      await callQueue.dequeueFromAll(visitorId);
 *
 *    On call ended (in sip-signaling endCall):
 *      await callQueue.recordCallDuration(queueName, durationSeconds);
 *
 * 2. In agent-handler.js — initAgentHandler():
 *    On agent connect (after token verification):
 *      const { callQueue } = require('../services/call-queue');
 *      await callQueue.registerAgent(agent.id, agent.businessLines || []);
 *
 *    On agent disconnect (ws 'close' event):
 *      await callQueue.unregisterAgent(agent.id);
 *
 *    On accept_call message:
 *      // Get the call's business line from DB, then dequeue the visitor
 *      const callRow = await db.query('SELECT * FROM calls WHERE call_id = $1', [msg.callId]);
 *      if (callRow.rows[0]) {
 *        const bl = callRow.rows[0].business_line;
 *        const qName = getQueueName(bl);
 *        await callQueue.dequeue(qName, callRow.rows[0].visitor_id);
 *      }
 *
 * 3. In index.js — after initChatHandler(wssChat):
 *      const { callQueue } = require('./services/call-queue');
 *      const { initQueueUpdater } = require('./services/queue-updater');
 *      initQueueUpdater(wssChat, callQueue);
 *
 *    And register the queue API route:
 *      app.use('/api/queues', require('./routes/queue'));
 *
 * 4. WebSocket message format the widget expects:
 *      { type: 'queue_update', position: 2, estimatedWait: '~2 min', agentsOnline: 3 }
 *      { type: 'queue_long_wait', message: 'La espera es mayor de lo habitual...' }
 *
 * ═══════════════════════════════════════════════════════════════
 *
 * Redis data structures:
 *   queue:{name}                    — Sorted set (score=timestamp, member=callerId)
 *   queue:{name}:meta:{callerId}    — Hash with caller metadata
 *   queue:{name}:durations          — List of last 20 call durations (seconds)
 *   queue:agents:{businessLine}     — Set of online agent IDs
 *   queue:agents:all                — Set of all online agent IDs (fallback)
 *
 * All keys have 24h TTL for auto-cleanup.
 */

const { redis } = require('../utils/redis');
const { logger } = require('../utils/logger');

const KEY_TTL = 86400; // 24 hours
const MAX_DURATION_SAMPLES = 20;
const DEFAULT_AVG_DURATION = 180; // 3 minutes fallback

/**
 * All known queue names (must match queue-manager.js QUEUE_MAP)
 * @type {string[]}
 */
const ALL_QUEUES = [
  'queue-boostic',
  'queue-binnacle',
  'queue-marketing',
  'queue-tech',
  'queue-general',
];

/**
 * Map queue name to its business line (reverse of queue-manager.js QUEUE_MAP)
 * @param {string} queueName
 * @returns {string}
 */
function queueToBusinessLine(queueName) {
  const map = {
    'queue-boostic': 'boostic',
    'queue-binnacle': 'binnacle',
    'queue-marketing': 'marketing',
    'queue-tech': 'tech',
    'queue-general': 'general',
  };
  return map[queueName] || 'general';
}

/**
 * Format seconds into a human-readable wait time string.
 * @param {number} seconds
 * @returns {string}
 */
function formatWaitTime(seconds) {
  if (seconds < 60) return '< 1 min';
  if (seconds < 120) return '~1 min';
  if (seconds <= 300) return `~${Math.round(seconds / 60)} min`;
  return '> 5 min';
}

const callQueue = {
  /**
   * Add a caller to a queue.
   * @param {string} queueName - e.g. 'queue-boostic'
   * @param {string} callerId  - visitorId
   * @param {object} [metadata] - { phone, conversationId, businessLine, callId }
   * @returns {Promise<{ position: number, estimatedWait: string }>}
   */
  async enqueue(queueName, callerId, metadata = {}) {
    try {
      const timestamp = Date.now();
      const key = `queue:${queueName}`;

      // Add to sorted set (score = timestamp for FIFO)
      await redis.zAdd(key, timestamp, callerId);
      await redis.expire(key, KEY_TTL);

      // Store metadata as hash
      const metaKey = `queue:${queueName}:meta:${callerId}`;
      const metaFields = {
        phone: metadata.phone || '',
        conversationId: metadata.conversationId || '',
        businessLine: metadata.businessLine || '',
        callId: metadata.callId || '',
        enqueuedAt: String(timestamp),
      };
      for (const [field, value] of Object.entries(metaFields)) {
        await redis.hSet(metaKey, field, value);
      }
      await redis.expire(metaKey, KEY_TTL);

      // Calculate position and estimated wait
      const position = await this.getPosition(queueName, callerId);
      const estimatedWait = await this.getEstimatedWait(queueName, position);

      logger.info(`CallQueue: ${callerId} enqueued in ${queueName} at position ${position} (est. ${estimatedWait})`);

      return { position, estimatedWait };
    } catch (e) {
      logger.error(`CallQueue.enqueue error (${queueName}, ${callerId}):`, e.message);
      return { position: 1, estimatedWait: '~3 min' };
    }
  },

  /**
   * Remove a caller from a specific queue.
   * @param {string} queueName
   * @param {string} callerId
   * @returns {Promise<boolean>} true if removed
   */
  async dequeue(queueName, callerId) {
    try {
      const key = `queue:${queueName}`;
      const removed = await redis.zRem(key, callerId);

      // Clean up metadata
      const metaKey = `queue:${queueName}:meta:${callerId}`;
      await redis.del(metaKey);

      if (removed) {
        logger.info(`CallQueue: ${callerId} dequeued from ${queueName}`);
      }
      return !!removed;
    } catch (e) {
      logger.error(`CallQueue.dequeue error (${queueName}, ${callerId}):`, e.message);
      return false;
    }
  },

  /**
   * Remove a caller from ALL queues (e.g. on disconnect).
   * @param {string} callerId
   * @returns {Promise<void>}
   */
  async dequeueFromAll(callerId) {
    for (const queueName of ALL_QUEUES) {
      await this.dequeue(queueName, callerId);
    }
  },

  /**
   * Get a caller's current position (1-based).
   * @param {string} queueName
   * @param {string} callerId
   * @returns {Promise<number>} 1-based position, or 0 if not in queue
   */
  async getPosition(queueName, callerId) {
    try {
      const rank = await redis.zRank(`queue:${queueName}`, callerId);
      if (rank === null || rank === undefined) return 0;
      return rank + 1; // Convert 0-based rank to 1-based position
    } catch (e) {
      logger.error(`CallQueue.getPosition error (${queueName}, ${callerId}):`, e.message);
      return 0;
    }
  },

  /**
   * Get total queue size.
   * @param {string} queueName
   * @returns {Promise<number>}
   */
  async getQueueSize(queueName) {
    try {
      return await redis.zCard(`queue:${queueName}`);
    } catch (e) {
      logger.error(`CallQueue.getQueueSize error (${queueName}):`, e.message);
      return 0;
    }
  },

  /**
   * Get all callers in a queue, ordered by entry time (FIFO).
   * @param {string} queueName
   * @returns {Promise<Array<{ callerId: string, score: number, metadata: object }>>}
   */
  async getQueueMembers(queueName) {
    try {
      const key = `queue:${queueName}`;
      const members = await redis.zRangeWithScores(key, 0, -1);

      const result = [];
      for (const { value: callerId, score } of members) {
        const metaKey = `queue:${queueName}:meta:${callerId}`;
        let metadata = {};
        try {
          metadata = await redis.hGetAll(metaKey);
        } catch {}
        result.push({ callerId, score, metadata });
      }
      return result;
    } catch (e) {
      logger.error(`CallQueue.getQueueMembers error (${queueName}):`, e.message);
      return [];
    }
  },

  /**
   * Calculate estimated wait time based on historical call durations and online agents.
   * Formula: (position * avgCallDuration) / onlineAgents
   *
   * @param {string} queueName
   * @param {number} position - 1-based position in queue
   * @returns {Promise<string>} Human-readable wait time
   */
  async getEstimatedWait(queueName, position) {
    try {
      if (position <= 0) return '< 1 min';

      const businessLine = queueToBusinessLine(queueName);
      const avgDuration = await this._getAvgCallDuration(queueName);
      const agentCount = await this.getOnlineAgentCount(businessLine);
      const effectiveAgents = Math.max(agentCount, 1); // Minimum 1 to avoid division by zero

      const estimatedSeconds = (position * avgDuration) / effectiveAgents;
      return formatWaitTime(estimatedSeconds);
    } catch (e) {
      logger.error(`CallQueue.getEstimatedWait error (${queueName}):`, e.message);
      return '~3 min';
    }
  },

  /**
   * Calculate estimated wait in raw seconds (for sorting/comparison).
   * @param {string} queueName
   * @param {number} position
   * @returns {Promise<number>}
   */
  async getEstimatedWaitSeconds(queueName, position) {
    try {
      if (position <= 0) return 0;
      const businessLine = queueToBusinessLine(queueName);
      const avgDuration = await this._getAvgCallDuration(queueName);
      const agentCount = await this.getOnlineAgentCount(businessLine);
      const effectiveAgents = Math.max(agentCount, 1);
      return Math.round((position * avgDuration) / effectiveAgents);
    } catch (e) {
      return DEFAULT_AVG_DURATION;
    }
  },

  /**
   * Record a completed call's duration for average calculation.
   * Keeps only the last MAX_DURATION_SAMPLES entries per queue.
   *
   * @param {string} queueName
   * @param {number} durationSeconds
   * @returns {Promise<void>}
   */
  async recordCallDuration(queueName, durationSeconds) {
    try {
      if (!durationSeconds || durationSeconds <= 0) return;
      const key = `queue:${queueName}:durations`;
      await redis.lPush(key, String(Math.round(durationSeconds)));
      await redis.lTrim(key, 0, MAX_DURATION_SAMPLES - 1);
      await redis.expire(key, KEY_TTL);
      logger.debug(`CallQueue: Recorded ${durationSeconds}s duration for ${queueName}`);
    } catch (e) {
      logger.error(`CallQueue.recordCallDuration error (${queueName}):`, e.message);
    }
  },

  /**
   * Get average call duration from last N samples.
   * @private
   * @param {string} queueName
   * @returns {Promise<number>} average in seconds
   */
  async _getAvgCallDuration(queueName) {
    try {
      const key = `queue:${queueName}:durations`;
      const durations = await redis.lRange(key, 0, MAX_DURATION_SAMPLES - 1);
      if (!durations || durations.length === 0) return DEFAULT_AVG_DURATION;

      const nums = durations.map(Number).filter((n) => n > 0 && !isNaN(n));
      if (nums.length === 0) return DEFAULT_AVG_DURATION;

      const sum = nums.reduce((a, b) => a + b, 0);
      return Math.round(sum / nums.length);
    } catch (e) {
      return DEFAULT_AVG_DURATION;
    }
  },

  /**
   * Register an agent as online for specific business lines.
   * @param {string} agentId
   * @param {string[]} businessLines - e.g. ['boostic', 'tech']
   */
  async registerAgent(agentId, businessLines = []) {
    try {
      // Add to global agents set
      await redis.sAdd('queue:agents:all', agentId);
      await redis.expire('queue:agents:all', KEY_TTL);

      // Add to each business line's agent set
      for (const bl of businessLines) {
        const key = `queue:agents:${bl}`;
        await redis.sAdd(key, agentId);
        await redis.expire(key, KEY_TTL);
      }

      // Store which business lines this agent handles (for cleanup on disconnect)
      await redis.set(`queue:agent:${agentId}:lines`, JSON.stringify(businessLines), KEY_TTL);

      logger.info(`CallQueue: Agent ${agentId} registered for lines: ${businessLines.join(', ') || 'all'}`);
    } catch (e) {
      logger.error(`CallQueue.registerAgent error (${agentId}):`, e.message);
    }
  },

  /**
   * Unregister an agent (on disconnect).
   * @param {string} agentId
   */
  async unregisterAgent(agentId) {
    try {
      // Get the business lines this agent was handling
      const linesJSON = await redis.get(`queue:agent:${agentId}:lines`);
      const lines = linesJSON ? JSON.parse(linesJSON) : [];

      // Remove from global set
      await redis.sRem('queue:agents:all', agentId);

      // Remove from each business line's set
      for (const bl of lines) {
        await redis.sRem(`queue:agents:${bl}`, agentId);
      }

      await redis.del(`queue:agent:${agentId}:lines`);

      logger.info(`CallQueue: Agent ${agentId} unregistered`);
    } catch (e) {
      logger.error(`CallQueue.unregisterAgent error (${agentId}):`, e.message);
    }
  },

  /**
   * Get number of online agents for a business line.
   * Falls back to global agent count if no line-specific agents.
   *
   * @param {string} businessLine
   * @returns {Promise<number>}
   */
  async getOnlineAgentCount(businessLine) {
    try {
      // First check line-specific agents
      if (businessLine && businessLine !== 'general') {
        const count = await redis.sCard(`queue:agents:${businessLine}`);
        if (count > 0) return count;
      }
      // Fallback to global count
      return await redis.sCard('queue:agents:all') || 0;
    } catch (e) {
      logger.error(`CallQueue.getOnlineAgentCount error (${businessLine}):`, e.message);
      return 0;
    }
  },

  /**
   * Get comprehensive stats for all queues (for dashboard API).
   * @returns {Promise<object>}
   */
  async getAllQueueStats() {
    const stats = {};

    for (const queueName of ALL_QUEUES) {
      const businessLine = queueToBusinessLine(queueName);
      const size = await this.getQueueSize(queueName);
      const agentCount = await this.getOnlineAgentCount(businessLine);
      const avgDuration = await this._getAvgCallDuration(queueName);

      // Get longest waiting caller
      let longestWaitSeconds = 0;
      if (size > 0) {
        try {
          const members = await redis.zRangeWithScores(`queue:${queueName}`, 0, 0);
          if (members.length > 0) {
            longestWaitSeconds = Math.round((Date.now() - members[0].score) / 1000);
          }
        } catch {}
      }

      stats[queueName] = {
        businessLine,
        waiting: size,
        agentsOnline: agentCount,
        avgCallDuration: avgDuration,
        longestWaitSeconds,
        longestWait: longestWaitSeconds > 0 ? formatWaitTime(longestWaitSeconds) : '-',
        estimatedWaitNext: size > 0 ? await this.getEstimatedWait(queueName, 1) : '-',
      };
    }

    return stats;
  },
};

module.exports = { callQueue, formatWaitTime, ALL_QUEUES, queueToBusinessLine };
