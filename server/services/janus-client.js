/**
 * Janus WebRTC Gateway — REST API Client
 *
 * Controls Janus sessions for WebRTC-to-SIP bridging.
 * Server creates sessions, attaches SIP plugin, registers extensions,
 * and manages call lifecycle + recording.
 */

const { logger } = require('../utils/logger');

const JANUS_URL = process.env.JANUS_URL || 'http://janus:8088/janus';
const JANUS_ADMIN_URL = process.env.JANUS_ADMIN_URL || 'http://janus:7088/admin';
const JANUS_ADMIN_SECRET = process.env.JANUS_ADMIN_SECRET || 'janus-admin-secret';

// Active sessions: callId -> { sessionId, handleId, state }
const activeSessions = new Map();

// Transaction ID generator
let txCounter = 0;
function newTx() {
  return `tx-${Date.now()}-${++txCounter}`;
}

// ─── HTTP helpers ───

async function janusPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Janus HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function janusGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Janus HTTP ${res.status}`);
  return res.json();
}

// ─── Session Management ───

async function createSession() {
  const data = await janusPost(JANUS_URL, {
    janus: 'create',
    transaction: newTx(),
  });
  if (data.janus !== 'success') {
    throw new Error(`Failed to create session: ${JSON.stringify(data)}`);
  }
  const sessionId = data.data.id;
  logger.info(`Janus session created: ${sessionId}`);
  return sessionId;
}

async function destroySession(sessionId) {
  try {
    await janusPost(`${JANUS_URL}/${sessionId}`, {
      janus: 'destroy',
      transaction: newTx(),
    });
    logger.info(`Janus session destroyed: ${sessionId}`);
  } catch (e) {
    logger.warn(`Failed to destroy session ${sessionId}: ${e.message}`);
  }
}

// ─── Plugin Management ───

async function attachSipPlugin(sessionId) {
  const data = await janusPost(`${JANUS_URL}/${sessionId}`, {
    janus: 'attach',
    plugin: 'janus.plugin.sip',
    transaction: newTx(),
  });
  if (data.janus !== 'success') {
    throw new Error(`Failed to attach SIP plugin: ${JSON.stringify(data)}`);
  }
  const handleId = data.data.id;
  logger.info(`SIP plugin attached: session=${sessionId}, handle=${handleId}`);
  return handleId;
}

// ─── SIP Operations ───

async function sipRegister(sessionId, handleId, { proxy, username, secret, authuser }) {
  const data = await janusPost(`${JANUS_URL}/${sessionId}/${handleId}`, {
    janus: 'message',
    transaction: newTx(),
    body: {
      request: 'register',
      proxy: `sip:${proxy}`,
      username: `sip:${username}@${proxy}`,
      secret,
      authuser: authuser || username,
      display_name: 'RDGPhone',
    },
  });
  logger.info(`SIP register request sent: ${username}@${proxy}`);
  return data;
}

async function sipCall(sessionId, handleId, { uri, jsep }) {
  const body = {
    request: 'call',
    uri,
    autoaccept_reinvites: true,
    // Request Janus to record the call
    record: true,
    record_file: `/tmp/janus-recordings/call-${Date.now()}`,
  };

  const msg = {
    janus: 'message',
    transaction: newTx(),
    body,
  };

  if (jsep) {
    msg.jsep = jsep;
  }

  const data = await janusPost(`${JANUS_URL}/${sessionId}/${handleId}`, msg);
  logger.info(`SIP INVITE sent to ${uri}`);
  return data;
}

async function sipHangup(sessionId, handleId) {
  try {
    await janusPost(`${JANUS_URL}/${sessionId}/${handleId}`, {
      janus: 'message',
      transaction: newTx(),
      body: { request: 'hangup' },
    });
    logger.info(`SIP hangup sent: session=${sessionId}`);
  } catch (e) {
    logger.warn(`SIP hangup failed: ${e.message}`);
  }
}

// ─── Recording Control ───

async function startRecording(sessionId, handleId, callId) {
  try {
    await janusPost(`${JANUS_URL}/${sessionId}/${handleId}`, {
      janus: 'message',
      transaction: newTx(),
      body: {
        request: 'recording',
        action: 'start',
        audio: true,
        video: false,
        peer_audio: true,
        filename: `/tmp/janus-recordings/${callId}`,
      },
    });
    logger.info(`Recording started for call ${callId}`);
  } catch (e) {
    logger.warn(`Failed to start recording for ${callId}: ${e.message}`);
  }
}

async function stopRecording(sessionId, handleId) {
  try {
    await janusPost(`${JANUS_URL}/${sessionId}/${handleId}`, {
      janus: 'message',
      transaction: newTx(),
      body: {
        request: 'recording',
        action: 'stop',
      },
    });
    logger.info(`Recording stopped: session=${sessionId}`);
  } catch (e) {
    logger.warn(`Failed to stop recording: ${e.message}`);
  }
}

// ─── Long-poll for events (used during call setup) ───

async function pollEvents(sessionId, timeoutMs = 30000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${JANUS_URL}/${sessionId}?maxev=5`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    // Janus returns a single event or an array
    return Array.isArray(data) ? data : [data];
  } catch {
    return [];
  }
}

// ─── Health check ───

async function getInfo() {
  try {
    const data = await janusGet(`${JANUS_URL}/info`);
    return data;
  } catch (e) {
    logger.warn(`Janus health check failed: ${e.message}`);
    return null;
  }
}

// ─── Session tracking ───

function trackSession(callId, sessionId, handleId) {
  activeSessions.set(callId, { sessionId, handleId, state: 'setup', startedAt: Date.now() });
}

function getSession(callId) {
  return activeSessions.get(callId) || null;
}

function updateSessionState(callId, state) {
  const s = activeSessions.get(callId);
  if (s) s.state = state;
}

async function cleanupSession(callId) {
  const s = activeSessions.get(callId);
  if (!s) return;

  try {
    await stopRecording(s.sessionId, s.handleId);
    await sipHangup(s.sessionId, s.handleId);
    await destroySession(s.sessionId);
  } catch (e) {
    logger.warn(`Session cleanup error for ${callId}: ${e.message}`);
  }

  activeSessions.delete(callId);
  logger.info(`Session cleaned up for call ${callId}`);
}

// Cleanup all sessions on shutdown
async function cleanupAll() {
  for (const [callId] of activeSessions) {
    await cleanupSession(callId);
  }
}

// Periodic check for stale sessions (older than 1 hour)
const STALE_TIMEOUT = 60 * 60 * 1000;
const staleCheckInterval = setInterval(() => {
  const now = Date.now();
  for (const [callId, s] of activeSessions) {
    if (now - s.startedAt > STALE_TIMEOUT) {
      logger.warn(`Stale session detected: ${callId}, cleaning up`);
      cleanupSession(callId).catch(() => {});
    }
  }
}, 5 * 60 * 1000);
staleCheckInterval.unref();

module.exports = {
  createSession,
  destroySession,
  attachSipPlugin,
  sipRegister,
  sipCall,
  sipHangup,
  startRecording,
  stopRecording,
  pollEvents,
  getInfo,
  trackSession,
  getSession,
  updateSessionState,
  cleanupSession,
  cleanupAll,
  activeSessions,
};
