const { Router } = require('express');
const { db } = require('../utils/db');
const { requireAgent } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/error-handler');
const { scoreLead } = require('../services/lead-capture');

const router = Router();

// List leads (agent-only)
router.get('/', requireAgent, asyncRoute(async (req, res) => {
  const { status, businessLine, limit, offset } = req.query;
  const leads = await db.getLeads({
    status,
    businessLine,
    limit: Math.min(parseInt(limit) || 50, 200),
    offset: parseInt(offset) || 0,
  });
  res.json(leads);
}));

// Update lead (agent-only)
router.patch('/:id', requireAgent, asyncRoute(async (req, res) => {
  const { status, notes } = req.body;
  const fields = {};
  if (status) {
    if (!['new', 'contacted', 'qualified', 'converted', 'lost'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    fields.status = status;
  }
  if (notes !== undefined) {
    if (typeof notes !== 'string' || notes.length > 5000) {
      return res.status(400).json({ error: 'Notes must be a string (max 5000 chars)' });
    }
    fields.notes = notes;
  }
  const lead = await db.updateLead(req.params.id, fields);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(lead);
}));

// Score lead
router.post('/:id/score', requireAgent, asyncRoute(async (req, res) => {
  const score = await scoreLead(req.params.id);
  res.json({ score });
}));

module.exports = router;
