/**
 * Business Unit Information Endpoint
 * GET /api/business-units - Get all BU info
 * GET /api/business-units/:name - Get specific BU
 * GET /api/business-units/:name/extensions - Get extensions for BU
 */

const express = require('express');
const router = express.Router();
const buRouter = require('../services/bu-router');
const { requireAgent } = require('../middleware/auth');

// Get all business units
router.get('/', (req, res) => {
  try {
    const config = buRouter.loadConfig();
    res.json({
      business_units: config.business_units,
      pbx: config.pbx,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific business unit
router.get('/:name', (req, res) => {
  try {
    const bu = buRouter.getBusinessUnit(req.params.name);
    res.json(bu);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Get extensions for business unit
router.get('/:name/extensions', (req, res) => {
  try {
    const extensions = buRouter.getAvailableExtensions(req.params.name);
    res.json({ business_unit: req.params.name, extensions });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Route conversation to BU (agent only)
router.post('/:name/route', requireAgent, async (req, res) => {
  try {
    const { conversationId, extension } = req.body;
    const routing = await buRouter.routeConversation(
      { id: conversationId, business_line: req.params.name },
      { extension }
    );
    res.json(routing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
