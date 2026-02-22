const { redis } = require('../utils/redis');

// M-06: In-memory fallback store when Redis is unavailable
const memoryStore = new Map();

// Cleanup stale in-memory entries every 60s
const memoryCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (now > entry.resetAt) memoryStore.delete(key);
  }
}, 60000);
memoryCleanupInterval.unref();

function rateLimit({ maxRequests = 60, windowSec = 60, keyFn } = {}) {
  return async (req, res, next) => {
    const key = keyFn ? keyFn(req) : req.ip;
    try {
      const allowed = await redis.rateLimit(key, maxRequests, windowSec);
      if (!allowed) {
        return res.status(429).json({ error: 'Too many requests' });
      }
    } catch {
      // M-06: Fallback to in-memory rate limiting when Redis is down
      const windowMs = windowSec * 1000;
      const now = Date.now();
      const entry = memoryStore.get(key) || { count: 0, resetAt: now + windowMs };
      if (now > entry.resetAt) {
        entry.count = 0;
        entry.resetAt = now + windowMs;
      }
      entry.count++;
      memoryStore.set(key, entry);
      if (entry.count > maxRequests) {
        return res.status(429).json({ error: 'Too many requests' });
      }
    }
    next();
  };
}

module.exports = { rateLimit };
