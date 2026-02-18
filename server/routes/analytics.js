const { Router } = require('express');
const { requireAgent } = require('../middleware/auth');
const { getAnalyticsStats } = require('../services/analytics');

const router = Router();

router.get('/', requireAgent, async (req, res) => {
  const { from, to } = req.query;
  const stats = await getAnalyticsStats({ from, to });
  res.json(stats);
});

module.exports = router;
