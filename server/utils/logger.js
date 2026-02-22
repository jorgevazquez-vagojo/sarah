const winston = require('winston');
const path = require('path');

const logDir = path.join(__dirname, '..', 'logs');
const isProduction = process.env.NODE_ENV === 'production';

// ─── Per-module log level overrides (via env) ───
// Example: LOG_LEVEL_CRM=debug, LOG_LEVEL_AI=warn
const moduleLogLevels = {};

/**
 * Parse per-module log levels from environment variables.
 * Format: LOG_LEVEL_<MODULE>=<level>
 */
function getModuleLevel(moduleName) {
  if (moduleLogLevels[moduleName]) return moduleLogLevels[moduleName];

  const envKey = `LOG_LEVEL_${moduleName.toUpperCase().replace(/-/g, '_')}`;
  const level = process.env[envKey];
  if (level) {
    moduleLogLevels[moduleName] = level;
    return level;
  }
  return null;
}

// ─── Formats ───

// Development: human-readable colored output
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, stack, module: mod, requestId, tenantId, ...meta }) => {
    const prefix = mod ? `[${mod}]` : '';
    const reqCtx = requestId ? ` req=${requestId.slice(0, 8)}` : '';
    const tenCtx = tenantId ? ` tenant=${tenantId}` : '';
    const metaStr = Object.keys(meta).length > 0 ? ' ' + JSON.stringify(meta) : '';
    return `${timestamp} ${level} ${prefix}${reqCtx}${tenCtx} ${stack || message}${metaStr}`;
  })
);

// Production: structured JSON for log aggregation (ELK, Loki, CloudWatch)
const prodFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// ─── Transports ───
const transports = [
  new winston.transports.Console({
    format: isProduction ? prodFormat : devFormat,
  }),
];

// File logging in production
if (isProduction) {
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: prodFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: prodFormat,
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 5,
    })
  );
}

// ─── Root logger ───
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'sarah' },
  transports,
});

/**
 * Create a child logger with module context.
 * Supports per-module log level overrides via LOG_LEVEL_<MODULE> env vars.
 *
 * Usage:
 *   const log = require('../utils/logger').logger.child({ module: 'crm' });
 *   log.info('CRM sync complete', { tenant: 'acme' });
 *
 * @param {Object} meta - Metadata to attach to all messages (e.g. { module: 'crm' })
 * @returns {winston.Logger} Child logger instance
 */
const originalChild = logger.child.bind(logger);
logger.child = function (meta = {}) {
  const child = originalChild(meta);

  // Apply per-module log level if configured
  if (meta.module) {
    const moduleLevel = getModuleLevel(meta.module);
    if (moduleLevel) {
      child.level = moduleLevel;
    }
  }

  return child;
};

/**
 * Express middleware that attaches request context (requestId, tenantId)
 * to a child logger on req.log for use in route handlers.
 *
 * Usage in routes:
 *   req.log.info('Processing request');
 */
function requestLoggerMiddleware(req, _res, next) {
  req.log = logger.child({
    requestId: req.requestId || req.headers['x-request-id'],
    tenantId: req.headers['x-tenant-id'] || req.query.tenantId,
  });
  next();
}

module.exports = { logger, requestLoggerMiddleware };
