const client = require('prom-client');

// ─── Default metrics (process CPU, memory, event loop lag, etc.) ───
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// ─── Custom metrics ───

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const websocketConnectionsActive = new client.Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['type'],
  registers: [register],
});

const chatMessagesTotal = new client.Counter({
  name: 'chat_messages_total',
  help: 'Total number of chat messages',
  labelNames: ['sender_type'],
  registers: [register],
});

const callsActive = new client.Gauge({
  name: 'calls_active',
  help: 'Number of active VoIP calls',
  registers: [register],
});

const leadsCapturedTotal = new client.Counter({
  name: 'leads_captured_total',
  help: 'Total number of leads captured',
  registers: [register],
});

// ─── HTTP metrics middleware ───
function metricsMiddleware(req, res, next) {
  // Skip metrics endpoint itself to avoid recursion
  if (req.path === '/metrics') return next();

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationSec = durationNs / 1e9;

    // Normalize path to avoid high-cardinality labels
    const normalizedPath = normalizePath(req.route?.path || req.path);

    httpRequestsTotal.inc({
      method: req.method,
      path: normalizedPath,
      status: res.statusCode,
    });

    httpRequestDuration.observe(
      { method: req.method, path: normalizedPath, status: res.statusCode },
      durationSec
    );
  });

  next();
}

/**
 * Normalize path to prevent high-cardinality label explosion.
 * Replaces UUIDs and numeric IDs with placeholders.
 */
function normalizePath(p) {
  return p
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+/g, '/:id');
}

module.exports = {
  register,
  metricsMiddleware,
  httpRequestsTotal,
  httpRequestDuration,
  websocketConnectionsActive,
  chatMessagesTotal,
  callsActive,
  leadsCapturedTotal,
};
