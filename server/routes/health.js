const { Router } = require('express');
const { db } = require('../utils/db');
const { redis } = require('../utils/redis');

const router = Router();

router.get('/health', async (_req, res) => {
  const checks = { server: 'ok', postgres: 'unknown', redis: 'unknown' };
  try {
    await db.query('SELECT 1');
    checks.postgres = 'ok';
  } catch {
    checks.postgres = 'error';
  }
  try {
    await redis.set('health', 'ok', 10);
    checks.redis = 'ok';
  } catch {
    checks.redis = 'error';
  }
  const allOk = Object.values(checks).every((v) => v === 'ok');
  res.status(allOk ? 200 : 503).json(checks);
});

module.exports = router;
