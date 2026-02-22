const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../utils/db');
const { generateToken, requireAgent } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/error-handler');
const { validate } = require('../middleware/validate');
const { rateLimit } = require('../middleware/rate-limit');
const { loginAgent, updateStatus } = require('../schemas/agents');

const router = Router();

// Agent login — rate limited to prevent brute force (5 attempts per minute per IP)
router.post('/login', rateLimit({ maxRequests: 5, windowSec: 60, keyFn: (req) => `login:${req.ip}` }),
  validate(loginAgent),
  asyncRoute(async (req, res) => {
    const { username, password } = req.body;

    const agent = await db.getAgentByUsername(username);
    if (!agent || !await bcrypt.compare(password, agent.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await db.updateAgentStatus(agent.id, 'online');
    const token = generateToken(agent);
    res.json({
      token,
      agent: {
        id: agent.id,
        username: agent.username,
        displayName: agent.display_name,
        role: agent.role,
        email: agent.email,
        languages: agent.languages,
        businessLines: agent.business_lines,
        tenantId: agent.tenant_id,
      },
    });
  })
);

// Get current agent profile (tenant-isolated)
router.get('/me', requireAgent, asyncRoute(async (req, res) => {
  const agent = await db.getAgent(req.agent.id, req.tenantId);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  const { password_hash, ...safe } = agent;
  res.json(safe);
}));

// Update status (validated)
router.patch('/status', requireAgent, validate(updateStatus), asyncRoute(async (req, res) => {
  const { status } = req.body;
  await db.updateAgentStatus(req.agent.id, status, req.tenantId);
  res.json({ status });
}));

// List online agents (agent-only, tenant-isolated)
router.get('/', requireAgent, asyncRoute(async (req, res) => {
  const agents = await db.getAvailableAgents({ tenantId: req.tenantId });
  res.json(agents.map(({ password_hash, ...a }) => a));
}));

// Queue: waiting conversations (tenant-isolated)
router.get('/queue', requireAgent, asyncRoute(async (req, res) => {
  const conversations = await db.getWaitingConversations(req.tenantId);
  res.json(conversations);
}));

module.exports = router;
