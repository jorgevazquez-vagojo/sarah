const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production');
}
const secret = JWT_SECRET || 'dev-secret-' + require('crypto').randomBytes(16).toString('hex');

function generateToken(agent) {
  return jwt.sign(
    {
      id: agent.id,
      username: agent.username,
      displayName: agent.display_name,
      role: agent.role || 'agent',
      tenantId: agent.tenant_id || null,
    },
    secret,
    { expiresIn: '12h' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, secret, { algorithms: ['HS256'] });
}

// Middleware: require JWT for agent endpoints
// Sets req.agent (decoded JWT) and req.tenantId for downstream tenant isolation
function requireAgent(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    req.agent = verifyToken(header.slice(7));
    // Propagate tenantId from the JWT to the request for tenant isolation
    req.tenantId = req.agent.tenantId || null;
    next();
  } catch (e) {
    logger.warn(`Invalid agent token: ${e.message}`);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Middleware: require API key for widget
// Also resolves tenantId from the tenant's API key in the database
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.apiKey;
  if (!key || key !== process.env.WIDGET_API_KEY) {
    // In development, allow without key ONLY if explicitly opted in
    if (process.env.NODE_ENV === 'development' && process.env.DEV_SKIP_AUTH === 'true') return next();
    return res.status(403).json({ error: 'Invalid API key' });
  }
  next();
}

// Middleware: resolve tenant from query param or header
// Sets req.tenantId for use by downstream handlers
function resolveTenant(req, _res, next) {
  // Priority: JWT tenantId > X-Tenant-ID header > tenant query param
  if (!req.tenantId) {
    req.tenantId = req.headers['x-tenant-id'] || req.query.tenant || null;
  }
  next();
}

// Middleware: require specific role(s)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.agent) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.agent.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { generateToken, verifyToken, requireAgent, requireApiKey, requireRole, resolveTenant };
