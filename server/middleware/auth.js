const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function generateToken(agent) {
  return jwt.sign(
    { id: agent.id, username: agent.username, displayName: agent.display_name },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// Middleware: require JWT for agent endpoints
function requireAgent(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    req.agent = verifyToken(header.slice(7));
    next();
  } catch (e) {
    logger.warn(`Invalid agent token: ${e.message}`);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Middleware: require API key for widget
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.apiKey;
  if (!key || key !== process.env.WIDGET_API_KEY) {
    // In development, allow without key
    if (process.env.NODE_ENV === 'development') return next();
    return res.status(403).json({ error: 'Invalid API key' });
  }
  next();
}

module.exports = { generateToken, verifyToken, requireAgent, requireApiKey, JWT_SECRET };
