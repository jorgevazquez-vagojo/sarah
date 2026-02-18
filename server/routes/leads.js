const { Router } = require('express');
const { db } = require('../utils/db');
const { requireAgent } = require('../middleware/auth');
const { scoreLead } = require('../services/lead-capture');

const router = Router();

// List leads (agent-only)
router.get('/', requireAgent, async (req, res) => {
  const { status, businessLine, limit, offset } = req.query;
  const leads = await db.getLeads({
    status,
    businessLine,
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
  });
  res.json(leads);
});

// Update lead (agent-only)
router.patch('/:id', requireAgent, async (req, res) => {
  const { status, notes } = req.body;
  const fields = {};
  if (status) fields.status = status;
  if (notes !== undefined) fields.notes = notes;
  const lead = await db.updateLead(req.params.id, fields);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(lead);
});

// Score lead
router.post('/:id/score', requireAgent, async (req, res) => {
  const score = await scoreLead(req.params.id);
  res.json({ score });
});

module.exports = router;
