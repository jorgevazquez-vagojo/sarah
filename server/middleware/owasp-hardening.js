/**
 * OWASP Top 10 Security Hardening
 * 1. Injection prevention (parameterized queries, input validation)
 * 2. Authentication/Session management (JWT, secure cookies)
 * 3. Sensitive data exposure (encryption, HTTPS only)
 * 4. XML External Entities (disabled)
 * 5. Broken access control (tenant isolation, role checks)
 * 6. Security misconfiguration (CSP, HSTS, X-Frame-Options)
 * 7. XSS prevention (Content-Type validation, escaping)
 * 8. Insecure deserialization (JSON.parse with schema validation)
 * 9. Using components with known vulnerabilities (npm audit)
 * 10. Insufficient logging & monitoring (structured logging)
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('mongo-sanitize');
const xss = require('xss-clean');

// 1. Security Headers (helmet)
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'nonce-{NONCE}'"],
      styleSrc: ["'self'", "'nonce-{NONCE}'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'wss:', 'https:'],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : undefined,
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

// 2. Input Sanitization
const sanitizeInputs = (req, res, next) => {
  // Remove $ and . from keys (NoSQL injection prevention)
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = mongoSanitize().sanitize(req.body[key]);
      }
    });
  }
  next();
};

// 3. Prevent Parameter Pollution
const preventParamPollution = (req, res, next) => {
  // Keep only first value if duplicate params
  Object.keys(req.query).forEach(key => {
    if (Array.isArray(req.query[key])) {
      req.query[key] = req.query[key][0];
    }
  });
  next();
};

// 4. Prevent XXE (XML External Entity)
const preventXXE = (req, res, next) => {
  if (req.headers['content-type']?.includes('xml')) {
    return res.status(400).json({ error: 'XML not supported' });
  }
  next();
};

// 5. Tenant Isolation (every query must have tenant_id)
const enforceTenantIsolation = (req, res, next) => {
  // Validate all requests have tenant context
  if (!req.user?.tenant_id && !req.body?.tenant_id) {
    return res.status(401).json({ error: 'Tenant context required' });
  }
  req.tenantId = req.user?.tenant_id || req.body?.tenant_id;
  next();
};

// 6. Role-Based Access Control
const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

// 7. Rate limiting (per IP + per user)
const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 minutes
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false,
});

// 8. CORS strictness
const strictCors = (req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());

  if (process.env.NODE_ENV === 'production' && origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'CORS policy violation' });
  }

  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.header('Access-Control-Max-Age', '3600');
  next();
};

// 9. Secure cookies
const secureCookies = {
  secure: process.env.NODE_ENV === 'production', // HTTPS only
  httpOnly: true,
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
};

// 10. Logging & Monitoring
const auditLog = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logger = require('../services/logger');

    // Log suspicious activities
    if (res.statusCode >= 400) {
      logger.warn('HTTP error', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        userId: req.user?.id,
        tenantId: req.tenantId,
        duration,
      });
    }
  });
  next();
};

module.exports = {
  securityHeaders,
  sanitizeInputs,
  preventParamPollution,
  preventXXE,
  enforceTenantIsolation,
  requireRole,
  globalRateLimit,
  strictCors,
  secureCookies,
  auditLog,
};
