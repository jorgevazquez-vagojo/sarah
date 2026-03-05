const { createClient } = require('redis');
const { logger } = require('./logger');

const redisHost = process.env.REDIS_HOST || 'redis';
const redisPassword = process.env.REDIS_PASSWORD || '';
const encodedRedisPassword = encodeURIComponent(redisPassword);
const redisUrl = encodedRedisPassword
  ? `redis://:${encodedRedisPassword}@${redisHost}:6379`
  : `redis://${redisHost}:6379`;

const client = createClient({ url: redisUrl });

client.on('error', (err) => logger.error('Redis error:', err));

const redis = {
  connect: () => client.connect(),
  quit: () => client.quit(),
  get: (k) => client.get(k),
  set: (k, v, ttl) => (ttl ? client.setEx(k, ttl, v) : client.set(k, v)),
  del: (k) => client.del(k),
  getJSON: async (k) => { const v = await client.get(k); return v ? JSON.parse(v) : null; },
  setJSON: (k, v, ttl) => redis.set(k, JSON.stringify(v), ttl),

  // Atomic rate limiting using INCR+EXPIRE in one pipeline to avoid race conditions
  rateLimit: async (key, maxRequests, windowSec) => {
    const rlKey = `rl:${key}`;
    const results = await client.multi()
      .incr(rlKey)
      .expire(rlKey, windowSec, 'NX')
      .exec();
    const current = results[0];
    return current <= maxRequests;
  },

  lPush: (k, v) => client.lPush(k, typeof v === 'string' ? v : JSON.stringify(v)),
  lRange: (k, start, end) => client.lRange(k, start, end),
  lLen: (k) => client.lLen(k),

  // Pub/Sub for real-time agent notifications
  publish: (channel, data) => client.publish(channel, typeof data === 'string' ? data : JSON.stringify(data)),
  _subscriber: null,
  _subscriberPromise: null,
  subscribe: async (channel, handler) => {
    // Prevent race condition: only one subscriber creation at a time
    if (!redis._subscriberPromise) {
      redis._subscriberPromise = (async () => {
        const sub = client.duplicate();
        await sub.connect();
        return sub;
      })();
    }
    if (!redis._subscriber) {
      redis._subscriber = await redis._subscriberPromise;
    }
    await redis._subscriber.subscribe(channel, (msg) => {
      try { handler(JSON.parse(msg)); } catch { handler(msg); }
    });
  },

  cached: async (key, ttl, fetchFn) => {
    const cached = await client.get(`cache:${key}`);
    if (cached) return JSON.parse(cached);
    const fresh = await fetchFn();
    await client.setEx(`cache:${key}`, ttl, JSON.stringify(fresh));
    return fresh;
  },

  // ─── Sorted sets (for call queue position tracking) ───
  zAdd: (k, score, member) => client.zAdd(k, { score, value: member }),
  zRem: (k, member) => client.zRem(k, member),
  zRank: (k, member) => client.zRank(k, member),
  zCard: (k) => client.zCard(k),
  zRange: (k, start, end) => client.zRange(k, start, end),
  zRangeWithScores: (k, start, end) => client.zRangeWithScores(k, start, end),

  // ─── Sets (for agent tracking) ───
  sAdd: (k, ...members) => client.sAdd(k, members),
  sRem: (k, ...members) => client.sRem(k, members),
  sMembers: (k) => client.sMembers(k),
  sCard: (k) => client.sCard(k),

  // ─── Key expiry ───
  expire: (k, seconds) => client.expire(k, seconds),

  // ─── Hash (for caller metadata) ───
  hSet: (k, field, value) => client.hSet(k, field, value),
  hGetAll: (k) => client.hGetAll(k),
  hDel: (k, ...fields) => client.hDel(k, fields),

  // ─── List trim (for bounded duration lists) ───
  lTrim: (k, start, end) => client.lTrim(k, start, end),
};

module.exports = { redis };
