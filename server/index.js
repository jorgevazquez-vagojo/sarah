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
app.use(express.json({ limit: '15mb' }));

// ─── Static files ───
app.use('/widget', express.static(path.join(__dirname, 'public', 'widget')));
app.use('/dashboard', express.static(path.join(__dirname, 'public', 'dashboard')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── REST Routes ───
app.use(require('./routes/health'));
app.use('/api/config', require('./routes/config'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/agents', require('./routes/agents'));
app.use('/api/calls', require('./routes/call'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/upload', require('./routes/upload'));

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

// ─── Attach WS handlers ───
const { initChatHandler } = require('./ws/chat-handler');
initChatHandler(wssChat);

const { initAgentHandler } = require('./ws/agent-handler');
initAgentHandler(wssAgent);

const { initSipSignaling } = require('./ws/sip-signaling');
initSipSignaling(wssSip);

// ─── Premium test page ───
app.get('/widget/test.html', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redegal Chatbot - Widget Demo</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
    .demo-page { max-width: 1200px; margin: 0 auto; padding: 60px 24px; color: white; }
    h1 { font-size: 48px; font-weight: 800; margin-bottom: 16px; }
    p { font-size: 18px; opacity: 0.9; max-width: 600px; line-height: 1.6; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; margin-top: 48px; }
    .card { background: rgba(255,255,255,0.1); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.2); border-radius: 16px; padding: 24px; }
    .card h3 { font-size: 18px; margin-bottom: 8px; }
    .card p { font-size: 14px; opacity: 0.8; }
    .config-panel { margin-top: 48px; background: rgba(255,255,255,0.1); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.2); border-radius: 16px; padding: 24px; }
    .config-panel h3 { margin-bottom: 16px; }
    .config-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
    .config-row label { min-width: 120px; font-size: 14px; }
    .config-row input, .config-row select { padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: white; font-size: 14px; }
    .config-row input[type="color"] { padding: 0; width: 40px; height: 32px; cursor: pointer; }
    .btn { padding: 8px 20px; background: white; color: #764ba2; font-weight: 600; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
    .btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="demo-page">
    <h1>Redegal Chatbot</h1>
    <p>Widget premium con chatbot IA, webphone VoIP, 12 idiomas y configuracion completa. Prueba el widget en la esquina inferior derecha.</p>

    <div class="cards">
      <div class="card">
        <h3>12 Idiomas</h3>
        <p>Deteccion automatica + selector manual. ES, EN, PT, FR, DE, IT, NL, ZH, JA, KO, AR, GL</p>
      </div>
      <div class="card">
        <h3>4 Lineas de Negocio</h3>
        <p>Boostic (SEO), Binnacle (BI), Marketing, Tech. Routing inteligente por intencion.</p>
      </div>
      <div class="card">
        <h3>IA Multi-Provider</h3>
        <p>Claude (primario) + Gemini (fallback gratuito) + OpenAI. Cambio automatico si falla.</p>
      </div>
      <div class="card">
        <h3>VoIP WebRTC</h3>
        <p>Llamadas directas desde el widget via SIP.js + Asterisk. Solo en horario laboral.</p>
      </div>
    </div>

    <div class="config-panel">
      <h3>Personalizar Widget en Tiempo Real</h3>
      <div class="config-row">
        <label>Color primario:</label>
        <input type="color" value="#E30613" onchange="updateConfig('primaryColor', this.value)" />
      </div>
      <div class="config-row">
        <label>Posicion:</label>
        <select onchange="updateConfig('position', this.value)">
          <option value="bottom-right">Abajo derecha</option>
          <option value="bottom-left">Abajo izquierda</option>
        </select>
      </div>
      <div class="config-row">
        <label>Idioma:</label>
        <select onchange="updateConfig('language', this.value)">
          <option value="auto">Auto-detectar</option>
          <option value="es">Espanol</option>
          <option value="en">English</option>
          <option value="pt">Portugues</option>
          <option value="fr">Francais</option>
          <option value="de">Deutsch</option>
          <option value="it">Italiano</option>
          <option value="nl">Nederlands</option>
          <option value="zh">中文</option>
          <option value="ja">日本語</option>
          <option value="ko">한국어</option>
          <option value="ar">العربية</option>
          <option value="gl">Galego</option>
        </select>
      </div>
    </div>
  </div>

  <script>
    window.RedegalChatbot = {
      baseUrl: window.location.origin + '/widget',
      apiUrl: 'ws://' + window.location.host + '/ws/chat',
      configUrl: window.location.origin + '/api/config/widget',
      language: 'auto',
      primaryColor: '#E30613'
    };
    function updateConfig(key, val) {
      if (window.__redegalWidget) window.__redegalWidget.updateConfig({ [key]: val });
    }
  </script>
  <script src="/widget/loader.js" async></script>
</body>
</html>`);
});

// ─── Startup ───
const PORT = process.env.PORT || 3000;

async function start() {
  // DB and Redis are required — fail fast if unavailable
  try {
    await db.connect();
    logger.info('PostgreSQL connected');
  } catch (e) {
    logger.error('PostgreSQL connection failed — aborting startup:', e.message);
    process.exit(1);
  }

  try {
    await redis.connect();
    logger.info('Redis connected');
  } catch (e) {
    logger.error('Redis connection failed — aborting startup:', e.message);
    process.exit(1);
  }

  loadLanguages();
  loadKnowledgeFiles();

  seedKnowledgeToDB().catch((e) => logger.warn('Knowledge seed error:', e.message));

  server.listen(PORT, () => {
    logger.info(`Redegal Chatbot server running on port ${PORT}`);
    logger.info(`Test page: http://localhost:${PORT}/widget/test.html`);
    logger.info(`Dashboard: http://localhost:${PORT}/dashboard`);
    logger.info(`Health: http://localhost:${PORT}/health`);
  });
}

start();

module.exports = { app, server, wssChat, wssAgent, wssSip };
