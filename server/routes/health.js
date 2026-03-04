const express = require('express');
const router = express.Router();
const { db } = require('../utils/db');
const { redis } = require('../utils/redis');
const logger = require('../services/logger');

router.get('/health', async (req, res) => {
  try {
    const checks = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {},
    };

    // Database check
    try {
      const result = await db.query('SELECT NOW()');
      checks.checks.database = { status: 'ok', responseTime: 'fast' };
    } catch (err) {
      checks.checks.database = { status: 'error', message: err.message };
      checks.status = 'degraded';
    }

    // Redis check
    try {
      await redis.get('_healthcheck');
      checks.checks.redis = { status: 'ok' };
    } catch (err) {
      checks.checks.redis = { status: 'error', message: err.message };
      checks.status = 'degraded';
    }

    const statusCode = checks.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(checks);
  } catch (err) {
    logger.error('Health check failed:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
