const { Router } = require('express');
const { requireAgent } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/error-handler');
const { getAnalyticsStats } = require('../services/analytics');

const router = Router();

router.get('/', requireAgent, asyncRoute(async (req, res) => {
  const { from, to } = req.query;
  const stats = await getAnalyticsStats({ from, to, tenantId: req.tenantId });
  res.json(stats);
}));

module.exports = router;
