const { Router } = require('express');
const { db } = require('../utils/db');
const { requireAgent } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/error-handler');
const { validate } = require('../middleware/validate');
const { scoreLead } = require('../services/lead-capture');
const { updateLead: updateLeadSchema } = require('../schemas/leads');

const router = Router();

// List leads (agent-only, tenant-isolated)
router.get('/', requireAgent, asyncRoute(async (req, res) => {
  const { status, businessLine, limit, offset } = req.query;
  const leads = await db.getLeads({
    status,
    businessLine,
    limit: Math.min(parseInt(limit) || 50, 200),
    offset: parseInt(offset) || 0,
    tenantId: req.tenantId,
  });
  res.json(leads);
}));

// Update lead (agent-only, validated, tenant-isolated)
router.patch('/:id', requireAgent, validate(updateLeadSchema), asyncRoute(async (req, res) => {
  const lead = await db.updateLead(req.params.id, req.body, req.tenantId);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(lead);
}));

// Score lead
router.post('/:id/score', requireAgent, asyncRoute(async (req, res) => {
  const score = await scoreLead(req.params.id);
  res.json({ score });
}));

module.exports = router;
