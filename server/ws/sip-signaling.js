const { logger } = require('../utils/logger');
const { verifyToken } = require('../middleware/auth');

function initSipSignaling(wss) {
  wss.on('connection', (ws, req) => {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const visitorId = params.get('visitorId');

    if (!visitorId) {
      ws.close(4001, 'Missing visitorId');
      return;
    }

    logger.info(`SIP signaling WS connected: ${visitorId}`);

    // This acts as a WSS proxy for SIP.js
    // In production, SIP.js connects directly to Asterisk's WSS endpoint
    // This signaling channel is for exchanging ICE candidates and session metadata

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        logger.debug(`SIP signal from ${visitorId}: ${msg.type}`);
        // Forward SIP messages — in production this would proxy to Asterisk
      } catch (e) {
        logger.warn(`Invalid SIP signal from ${visitorId}`);
      }
    });

    ws.on('close', () => {
      logger.info(`SIP signaling WS disconnected: ${visitorId}`);
    });
  });
}

module.exports = { initSipSignaling };
