// SIP Signaling (WebRTC relay) tests
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('../utils/db', () => ({
  db: {
    query: jest.fn().mockResolvedValue({ rows: [{ call_id: 'exists' }] }),
  },
}));
jest.mock('../utils/redis', () => ({
  redis: {
    subscribe: jest.fn().mockResolvedValue(null),
  },
}));
jest.mock('../middleware/auth', () => ({
  verifyToken: jest.fn((token) => {
    if (token === 'valid-token') return { id: 'agent-1', name: 'Agent One' };
    throw new Error('Invalid token');
  }),
}));
jest.mock('../integrations/webhooks', () => ({
  triggerWebhooks: jest.fn().mockResolvedValue(null),
}));

const { initSipSignaling, registerCall, activeCalls } = require('../ws/sip-signaling');
const { triggerWebhooks } = require('../integrations/webhooks');
const { db } = require('../utils/db');

// Mock WebSocket
function createMockWs(readyState = 1) {
  const ws = {
    readyState,
    send: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
    handlers: {},
  };
  ws.on.mockImplementation((event, handler) => {
    ws.handlers[event] = handler;
  });
  return ws;
}

// Mock WebSocketServer
function createMockWss() {
  const wss = {
    on: jest.fn(),
    handlers: {},
  };
  wss.on.mockImplementation((event, handler) => {
    wss.handlers[event] = handler;
  });
  return wss;
}

describe('SIP Signaling', () => {
  let wss;

  beforeEach(() => {
    jest.clearAllMocks();
    activeCalls.clear();
    wss = createMockWss();
    initSipSignaling(wss);
    // Default: DB returns a matching call
    db.query.mockResolvedValue({ rows: [{ call_id: 'exists' }] });
  });

  // Connection handler is now async — must await
  async function simulateConnection(role, callId, extra = {}) {
    const ws = createMockWs();
    const visitorId = extra.visitorId || 'visitor-12345678';
    const url = `http://localhost/ws/sip?role=${role}&callId=${callId}` +
      (extra.token ? `&token=${extra.token}` : '') +
      (extra.visitorId ? `&visitorId=${extra.visitorId}` : `&visitorId=${visitorId}`) +
      (extra.extension ? `&extension=${extra.extension}` : '');
    const req = { url };
    await wss.handlers.connection(ws, req);
    return ws;
  }

  describe('Connection Handling', () => {
    test('rejects connection without role', async () => {
      const ws = createMockWs();
      await wss.handlers.connection(ws, { url: 'http://localhost/ws/sip?callId=c1' });
      expect(ws.close).toHaveBeenCalledWith(4001, 'Missing role or callId');
    });

    test('rejects connection without callId', async () => {
      const ws = createMockWs();
      await wss.handlers.connection(ws, { url: 'http://localhost/ws/sip?role=visitor' });
      expect(ws.close).toHaveBeenCalledWith(4001, 'Missing role or callId');
    });

    test('rejects agent connection with invalid token', async () => {
      const ws = createMockWs();
      await wss.handlers.connection(ws, { url: 'http://localhost/ws/sip?role=agent&callId=c1&token=bad-token' });
      expect(ws.close).toHaveBeenCalledWith(4001, 'Invalid agent token');
    });

    test('rejects visitor without visitorId', async () => {
      const ws = createMockWs();
      await wss.handlers.connection(ws, { url: 'http://localhost/ws/sip?role=visitor&callId=c1' });
      expect(ws.close).toHaveBeenCalledWith(4002, 'Missing or invalid visitorId');
    });

    test('rejects visitor with short visitorId', async () => {
      const ws = createMockWs();
      await wss.handlers.connection(ws, { url: 'http://localhost/ws/sip?role=visitor&callId=c1&visitorId=abc' });
      expect(ws.close).toHaveBeenCalledWith(4002, 'Missing or invalid visitorId');
    });

    test('rejects visitor with unknown callId not in DB', async () => {
      db.query.mockResolvedValue({ rows: [] }); // No matching call
      const ws = createMockWs();
      await wss.handlers.connection(ws, { url: 'http://localhost/ws/sip?role=visitor&callId=unknown-call&visitorId=visitor-12345678' });
      expect(ws.close).toHaveBeenCalledWith(4003, 'Unknown callId');
    });

    test('accepts visitor when callId exists in activeCalls', async () => {
      registerCall('active-call-1', 'conv-1');
      const ws = await simulateConnection('visitor', 'active-call-1', { visitorId: 'visitor-12345678' });
      expect(ws.close).not.toHaveBeenCalled();
      expect(activeCalls.get('active-call-1').visitor).toBe(ws);
    });

    test('accepts visitor when callId exists in DB', async () => {
      db.query.mockResolvedValue({ rows: [{ call_id: 'db-call-1' }] });
      const ws = await simulateConnection('visitor', 'db-call-1', { visitorId: 'visitor-12345678' });
      expect(ws.close).not.toHaveBeenCalled();
      expect(activeCalls.has('db-call-1')).toBe(true);
    });

    test('accepts agent connection with valid token', async () => {
      const ws = await simulateConnection('agent', 'call-2', { token: 'valid-token' });
      expect(ws.close).not.toHaveBeenCalled();
      expect(activeCalls.has('call-2')).toBe(true);
      expect(activeCalls.get('call-2').agent).toBe(ws);
    });

    test('creates call session if not exists', async () => {
      const ws = await simulateConnection('visitor', 'new-call', { visitorId: 'visitor-12345678' });
      expect(ws.close).not.toHaveBeenCalled();
      expect(activeCalls.has('new-call')).toBe(true);
      const call = activeCalls.get('new-call');
      expect(call.visitor).not.toBeNull();
      expect(call.agent).toBeNull();
      expect(call.startedAt).toBeNull();
    });
  });

  describe('WebRTC Signal Relay', () => {
    test('relays SDP offer from visitor to agent', async () => {
      registerCall('relay-call', 'conv-1');
      const visitorWs = await simulateConnection('visitor', 'relay-call', { visitorId: 'visitor-12345678' });
      const agentWs = await simulateConnection('agent', 'relay-call', { token: 'valid-token' });

      // Visitor sends offer
      visitorWs.handlers.message(JSON.stringify({
        type: 'webrtc_offer',
        sdp: { type: 'offer', sdp: 'v=0...' },
      }));

      expect(agentWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"webrtc_offer"')
      );
    });

    test('relays SDP answer from agent to visitor', async () => {
      registerCall('relay-call-2', 'conv-1');
      const visitorWs = await simulateConnection('visitor', 'relay-call-2', { visitorId: 'visitor-12345678' });
      const agentWs = await simulateConnection('agent', 'relay-call-2', { token: 'valid-token' });

      // Agent sends answer
      agentWs.handlers.message(JSON.stringify({
        type: 'webrtc_answer',
        sdp: { type: 'answer', sdp: 'v=0...' },
      }));

      expect(visitorWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"webrtc_answer"')
      );
    });

    test('relays ICE candidates between peers', async () => {
      registerCall('ice-call', 'conv-1');
      const visitorWs = await simulateConnection('visitor', 'ice-call', { visitorId: 'visitor-12345678' });
      const agentWs = await simulateConnection('agent', 'ice-call', { token: 'valid-token' });

      // Visitor sends ICE candidate
      visitorWs.handlers.message(JSON.stringify({
        type: 'ice_candidate',
        candidate: { candidate: 'candidate:1 1 UDP ...' },
      }));

      expect(agentWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"ice_candidate"')
      );
    });

    test('does nothing if no peer connected', async () => {
      registerCall('no-peer', 'conv-1');
      const visitorWs = await simulateConnection('visitor', 'no-peer', { visitorId: 'visitor-12345678' });

      // Visitor sends offer but no agent yet
      visitorWs.handlers.message(JSON.stringify({
        type: 'webrtc_offer',
        sdp: { type: 'offer', sdp: 'v=0...' },
      }));

      // No crash, no error — just silent
    });
  });

  describe('Call Lifecycle', () => {
    test('start_call sets startedAt timestamp', async () => {
      registerCall('start-call', 'conv-1');
      const visitorWs = await simulateConnection('visitor', 'start-call', { visitorId: 'visitor-12345678' });

      visitorWs.handlers.message(JSON.stringify({ type: 'start_call' }));

      expect(activeCalls.get('start-call').startedAt).toBeInstanceOf(Date);
    });

    test('hangup notifies peer and ends call', async () => {
      registerCall('hangup-call', 'conv-1');
      const visitorWs = await simulateConnection('visitor', 'hangup-call', { visitorId: 'visitor-12345678' });
      const agentWs = await simulateConnection('agent', 'hangup-call', { token: 'valid-token' });

      visitorWs.handlers.message(JSON.stringify({ type: 'hangup' }));

      expect(agentWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"call_ended"')
      );
      // endCall is async (fire-and-forget from handleSignal) — wait for microtasks
      await new Promise((r) => setTimeout(r, 10));
      expect(activeCalls.has('hangup-call')).toBe(false);
    });

    test('disconnect notifies peer', async () => {
      registerCall('disconnect-call', 'conv-1');
      const visitorWs = await simulateConnection('visitor', 'disconnect-call', { visitorId: 'visitor-12345678' });
      const agentWs = await simulateConnection('agent', 'disconnect-call', { token: 'valid-token' });

      // Visitor disconnects
      visitorWs.handlers.close();

      expect(agentWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"visitor disconnected"')
      );
    });

    test('fires webhook on call end', async () => {
      registerCall('webhook-call', 'conv-1');
      const visitorWs = await simulateConnection('visitor', 'webhook-call', { visitorId: 'visitor-12345678' });
      await simulateConnection('agent', 'webhook-call', { token: 'valid-token' });

      // Start call then hangup
      visitorWs.handlers.message(JSON.stringify({ type: 'start_call' }));
      visitorWs.handlers.message(JSON.stringify({ type: 'hangup' }));

      // endCall is async — wait for microtasks
      await new Promise((r) => setTimeout(r, 10));

      expect(triggerWebhooks).toHaveBeenCalledWith(
        'call.ended',
        expect.objectContaining({ callId: 'webhook-call' })
      );
    });
  });

  describe('registerCall', () => {
    test('creates new call session', () => {
      registerCall('reg-call-1', 'conv-1');
      expect(activeCalls.has('reg-call-1')).toBe(true);
      expect(activeCalls.get('reg-call-1').conversationId).toBe('conv-1');
    });

    test('updates conversationId for existing call', () => {
      registerCall('reg-call-2', 'conv-old');
      registerCall('reg-call-2', 'conv-new');
      expect(activeCalls.get('reg-call-2').conversationId).toBe('conv-new');
    });
  });

  describe('Edge Cases', () => {
    test('handles invalid JSON in message', async () => {
      registerCall('json-err', 'conv-1');
      const visitorWs = await simulateConnection('visitor', 'json-err', { visitorId: 'visitor-12345678' });
      // Should not throw
      expect(() => visitorWs.handlers.message('not-json')).not.toThrow();
    });

    test('handles register signal type', async () => {
      registerCall('register-test', 'conv-1');
      const visitorWs = await simulateConnection('visitor', 'register-test', { visitorId: 'visitor-12345678' });
      // Should not throw
      visitorWs.handlers.message(JSON.stringify({ type: 'register' }));
    });

    test('handles unknown signal type gracefully', async () => {
      registerCall('unknown-sig', 'conv-1');
      const visitorWs = await simulateConnection('visitor', 'unknown-sig', { visitorId: 'visitor-12345678' });
      expect(() => {
        visitorWs.handlers.message(JSON.stringify({ type: 'totally_unknown' }));
      }).not.toThrow();
    });
  });
});
