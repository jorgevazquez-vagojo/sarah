const { redis } = require('../utils/redis');

function rateLimit({ maxRequests = 60, windowSec = 60, keyFn } = {}) {
  return async (req, res, next) => {
    const key = keyFn ? keyFn(req) : req.ip;
    try {
      const allowed = await redis.rateLimit(key, maxRequests, windowSec);
      if (!allowed) {
        return res.status(429).json({ error: 'Too many requests' });
      }
    } catch {
      // If Redis is down, allow the request
    }
    next();
  };
}

module.exports = { rateLimit };
