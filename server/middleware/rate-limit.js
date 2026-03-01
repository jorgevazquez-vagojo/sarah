const { redis } = require('../utils/redis');

// Token bucket per key (tenant or custom)
const getRateLimitKey = (key) => `ratelimit:${key}`;

function rateLimit({ maxRequests = 100, windowSec = 60, keyFn } = {}) {
  return async (req, res, next) => {
    try {
      const defaultKey = req.agent?.tenantId || req.user?.tenant_id || req.body?.tenant_id || req.ip || 'anonymous';
      const rawKey = typeof keyFn === 'function' ? keyFn(req) : defaultKey;
      const key = getRateLimitKey(rawKey);

      const allowed = await redis.rateLimit(key, maxRequests, windowSec);

      res.set('X-RateLimit-Limit', maxRequests);
      res.set('X-RateLimit-Remaining', allowed ? '1' : '0');

      if (!allowed) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: windowSec,
        });
      }

      next();
    } catch (err) {
      // On Redis error, allow the request
      next();
    }
  };
}

module.exports = { rateLimit };
