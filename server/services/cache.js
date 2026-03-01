const redis = require('../utils/redis');

const CACHE_TTL = {
  knowledge_base: 3600,      // 1 hour
  crm_response: 1800,         // 30 minutes
  language_dict: 86400,       // 24 hours
  theme: 120,                 // 2 minutes
};

async function getCached(key) {
  try {
    const client = redis.getClient();
    const value = await client.get(`cache:${key}`);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.warn('Cache get error:', err);
    return null;
  }
}

async function setCached(key, value, ttl = CACHE_TTL.theme) {
  try {
    const client = redis.getClient();
    await client.setEx(`cache:${key}`, ttl, JSON.stringify(value));
  } catch (err) {
    console.warn('Cache set error:', err);
  }
}

module.exports = { getCached, setCached, CACHE_TTL };
