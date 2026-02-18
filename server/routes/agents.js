const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../utils/db');
const { generateToken, requireAgent } = require('../middleware/auth');
const { asyncRoute } = require('../middleware/error-handler');
const { validate } = require('../middleware/validate');
const { rateLimit } = require('../middleware/rate-limit');

const router = Router();

// Agent login — rate limited to prevent brute force
router.post('/login', rateLimit({ maxRequests: 10, windowSec: 60, keyFn: (req) => `login:${req.ip}` }),
  validate({
    username: { required: true, type: 'string', minLength: 2, maxLength: 100 },
    password: { required: true, type: 'string', minLength: 4, maxLength: 200 },
  }),
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
      },
    });
  })
);

// Get current agent profile
router.get('/me', requireAgent, asyncRoute(async (req, res) => {
  const agent = await db.getAgent(req.agent.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  const { password_hash, ...safe } = agent;
  res.json(safe);
}));

// Update status
router.patch('/status', requireAgent, asyncRoute(async (req, res) => {
  const { status } = req.body;
  if (!['online', 'busy', 'away', 'offline'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  await db.updateAgentStatus(req.agent.id, status);
  res.json({ status });
}));

// List online agents (agent-only)
router.get('/', requireAgent, asyncRoute(async (req, res) => {
  const agents = await db.getAvailableAgents();
  res.json(agents.map(({ password_hash, ...a }) => a));
}));

// Queue: waiting conversations
router.get('/queue', requireAgent, asyncRoute(async (req, res) => {
  const conversations = await db.getWaitingConversations();
  res.json(conversations);
}));

module.exports = router;
