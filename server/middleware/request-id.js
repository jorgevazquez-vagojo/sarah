// Request ID middleware: adds a unique ID to each request for traceability
const crypto = require('crypto');

function requestId(req, res, next) {
  // Use existing header if provided (e.g. from load balancer), otherwise generate
  const id = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

module.exports = { requestId };
