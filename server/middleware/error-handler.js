const { logger } = require('../utils/logger');

// Async route wrapper: catches thrown errors and forwards to Express error handler
function asyncRoute(fn) {
  return (req, res, next) => {
    try {
      const result = fn(req, res, next);
      if (result && typeof result.catch === 'function') {
        result.catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}

// Global error handler — MUST be last middleware
function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message = status < 500 ? err.message : 'Internal server error';

  logger.error(`${req.method} ${req.originalUrl} -> ${status}: ${err.message}`, {
    requestId: req.requestId,
    stack: err.stack,
    body: req.body ? JSON.stringify(req.body).slice(0, 200) : undefined,
  });

  if (!res.headersSent) {
    res.status(status).json({ error: message });
  }
}

// 404 handler
function notFoundHandler(req, res) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
}

module.exports = { asyncRoute, errorHandler, notFoundHandler };
