const { redis } = require('../utils/redis');

const SESSION_TTL = 3600; // 1 hour

const sessionStore = {
  get: (visitorId) => redis.getJSON(`session:${visitorId}`),

  set: (visitorId, data) => redis.setJSON(`session:${visitorId}`, data, SESSION_TTL),

  update: async (visitorId, partial) => {
    const existing = (await redis.getJSON(`session:${visitorId}`)) || {};
    const merged = { ...existing, ...partial, updatedAt: Date.now() };
    await redis.setJSON(`session:${visitorId}`, merged, SESSION_TTL);
    return merged;
  },

  delete: (visitorId) => redis.del(`session:${visitorId}`),
};

module.exports = { sessionStore };
