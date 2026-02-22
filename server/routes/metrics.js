const { Router } = require('express');
const { register } = require('../services/metrics');

const router = Router();

/**
 * GET /metrics — Prometheus-compatible metrics endpoint
 * Returns metrics in Prometheus text exposition format.
 */
router.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (err) {
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

module.exports = router;
