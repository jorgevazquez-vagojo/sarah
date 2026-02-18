const http = require('http');
const express = require('express');
const path = require('path');
const { WebSocketServer } = require('ws');
const { logger } = require('./utils/logger');
const { db } = require('./utils/db');
const { redis } = require('./utils/redis');
const { loadLanguages } = require('./utils/i18n');
const { loadKnowledgeFiles, seedKnowledgeToDB } = require('./services/knowledge-base');
const { corsMiddleware } = require('./middleware/cors');

const app = express();
const server = http.createServer(app);

// ─── Middleware ───
app.use(corsMiddleware);
app.use(express.json());

// ─── Static files for widget and dashboard ───
app.use('/widget', express.static(path.join(__dirname, 'public', 'widget')));
app.use('/dashboard', express.static(path.join(__dirname, 'public', 'dashboard')));

// ─── REST Routes ───
app.use(require('./routes/health'));

// Lazy-load routes that depend on Phase 2+
try { app.use('/api/chat', require('./routes/chat')); } catch {}
try { app.use('/api/leads', require('./routes/leads')); } catch {}
try { app.use('/api/agents', require('./routes/agents')); } catch {}
try { app.use('/api/calls', require('./routes/call')); } catch {}
try { app.use('/api/analytics', require('./routes/analytics')); } catch {}

// ─── WebSocket upgrade handling ───
const wssChat = new WebSocketServer({ noServer: true });
const wssAgent = new WebSocketServer({ noServer: true });
const wssSip = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  if (pathname === '/ws/chat') {
    wssChat.handleUpgrade(req, socket, head, (ws) => wssChat.emit('connection', ws, req));
  } else if (pathname === '/ws/agent') {
    wssAgent.handleUpgrade(req, socket, head, (ws) => wssAgent.emit('connection', ws, req));
  } else if (pathname === '/ws/sip') {
    wssSip.handleUpgrade(req, socket, head, (ws) => wssSip.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

// ─── Attach WS handlers (lazy-loaded) ───
try {
  const { initChatHandler } = require('./ws/chat-handler');
  initChatHandler(wssChat);
} catch {}

try {
  const { initAgentHandler } = require('./ws/agent-handler');
  initAgentHandler(wssAgent);
} catch {}

try {
  const { initSipSignaling } = require('./ws/sip-signaling');
  initSipSignaling(wssSip);
} catch {}

// ─── Test page (development only) ───
app.get('/widget/test.html', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redegal Chatbot - Test</title>
  <style>body { font-family: sans-serif; padding: 40px; background: #f5f5f5; }</style>
</head>
<body>
  <h1>Redegal Chatbot Widget Test</h1>
  <p>El widget debería aparecer en la esquina inferior derecha.</p>
  <script>
    window.RedegalChatbot = {
      baseUrl: window.location.origin + '/widget',
      apiUrl: 'ws://' + window.location.host + '/ws/chat',
      language: 'auto',
      primaryColor: '#E30613'
    };
  </script>
  <script src="/widget/loader.js" async></script>
</body>
</html>`);
});

// ─── Startup ───
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await redis.connect();
    logger.info('Redis connected');
  } catch (e) {
    logger.error('Redis connection failed:', e.message);
  }

  try {
    await db.connect();
    logger.info('PostgreSQL connected');
  } catch (e) {
    logger.error('PostgreSQL connection failed:', e.message);
  }

  loadLanguages();
  loadKnowledgeFiles();

  // Seed knowledge to DB on startup (idempotent)
  seedKnowledgeToDB().catch((e) => logger.warn('Knowledge seed error:', e.message));

  server.listen(PORT, () => {
    logger.info(`Redegal Chatbot server running on port ${PORT}`);
  });
}

start();

module.exports = { app, server, wssChat, wssAgent, wssSip };
