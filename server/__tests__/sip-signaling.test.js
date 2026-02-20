// SIP Signaling (WebRTC relay) tests
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('../utils/db', () => ({ db: { query: jest.fn().mockResolvedValue({ rows: [] }) } }));
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
  });

  function simulateConnection(role, callId, extra = {}) {
    const ws = createMockWs();
    const url = `http://localhost/ws/sip?role=${role}&callId=${callId}` +
      (extra.token ? `&token=${extra.token}` : '') +
      (extra.extension ? `&extension=${extra.extension}` : '');
    const req = { url };
    wss.handlers.connection(ws, req);
    return ws;
  }

  describe('Connection Handling', () => {
    test('rejects connection without role', () => {
      const ws = createMockWs();
      wss.handlers.connection(ws, { url: 'http://localhost/ws/sip?callId=c1' });
      expect(ws.close).toHaveBeenCalledWith(4001, 'Missing role or callId');
    });

    test('rejects connection without callId', () => {
      const ws = createMockWs();
      wss.handlers.connection(ws, { url: 'http://localhost/ws/sip?role=visitor' });
      expect(ws.close).toHaveBeenCalledWith(4001, 'Missing role or callId');
    });

    test('rejects agent connection with invalid token', () => {
      const ws = createMockWs();
      wss.handlers.connection(ws, { url: 'http://localhost/ws/sip?role=agent&callId=c1&token=bad-token' });
      expect(ws.close).toHaveBeenCalledWith(4001, 'Invalid agent token');
    });

    test('accepts visitor connection', () => {
      const ws = simulateConnection('visitor', 'call-1', { extension: 'ext-1' });
      expect(ws.close).not.toHaveBeenCalled();
      expect(activeCalls.has('call-1')).toBe(true);
      expect(activeCalls.get('call-1').visitor).toBe(ws);
    });

    test('accepts agent connection with valid token', () => {
      const ws = simulateConnection('agent', 'call-2', { token: 'valid-token' });
      expect(ws.close).not.toHaveBeenCalled();
      expect(activeCalls.has('call-2')).toBe(true);
      expect(activeCalls.get('call-2').agent).toBe(ws);
    });

    test('creates call session if not exists', () => {
      simulateConnection('visitor', 'new-call');
      expect(activeCalls.has('new-call')).toBe(true);
      const call = activeCalls.get('new-call');
      expect(call.visitor).not.toBeNull();
      expect(call.agent).toBeNull();
      expect(call.startedAt).toBeNull();
    });
  });

  describe('WebRTC Signal Relay', () => {
    test('relays SDP offer from visitor to agent', () => {
      const visitorWs = simulateConnection('visitor', 'relay-call', { extension: 'ext-1' });
      const agentWs = simulateConnection('agent', 'relay-call', { token: 'valid-token' });

      // Visitor sends offer
      visitorWs.handlers.message(JSON.stringify({
        type: 'webrtc_offer',
        sdp: { type: 'offer', sdp: 'v=0...' },
      }));

      expect(agentWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"webrtc_offer"')
      );
    });

    test('relays SDP answer from agent to visitor', () => {
      const visitorWs = simulateConnection('visitor', 'relay-call-2', { extension: 'ext-1' });
      const agentWs = simulateConnection('agent', 'relay-call-2', { token: 'valid-token' });

      // Agent sends answer
      agentWs.handlers.message(JSON.stringify({
        type: 'webrtc_answer',
        sdp: { type: 'answer', sdp: 'v=0...' },
      }));

      expect(visitorWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"webrtc_answer"')
      );
    });

    test('relays ICE candidates between peers', () => {
      const visitorWs = simulateConnection('visitor', 'ice-call', { extension: 'ext-1' });
      const agentWs = simulateConnection('agent', 'ice-call', { token: 'valid-token' });

      // Visitor sends ICE candidate
      visitorWs.handlers.message(JSON.stringify({
        type: 'ice_candidate',
        candidate: { candidate: 'candidate:1 1 UDP ...' },
      }));

      expect(agentWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"ice_candidate"')
      );
    });

    test('does nothing if no peer connected', () => {
      const visitorWs = simulateConnection('visitor', 'no-peer', { extension: 'ext-1' });

      // Visitor sends offer but no agent yet
      visitorWs.handlers.message(JSON.stringify({
        type: 'webrtc_offer',
        sdp: { type: 'offer', sdp: 'v=0...' },
      }));

      // No crash, no error — just silent
    });
  });

  describe('Call Lifecycle', () => {
    test('start_call sets startedAt timestamp', () => {
      const visitorWs = simulateConnection('visitor', 'start-call', { extension: 'ext-1' });

      visitorWs.handlers.message(JSON.stringify({ type: 'start_call' }));

      expect(activeCalls.get('start-call').startedAt).toBeInstanceOf(Date);
    });

    test('hangup notifies peer and ends call', () => {
      const visitorWs = simulateConnection('visitor', 'hangup-call', { extension: 'ext-1' });
      const agentWs = simulateConnection('agent', 'hangup-call', { token: 'valid-token' });

      visitorWs.handlers.message(JSON.stringify({ type: 'hangup' }));

      expect(agentWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"call_ended"')
      );
      // Call should be cleaned up
      expect(activeCalls.has('hangup-call')).toBe(false);
    });

    test('disconnect notifies peer', () => {
      const visitorWs = simulateConnection('visitor', 'disconnect-call', { extension: 'ext-1' });
      const agentWs = simulateConnection('agent', 'disconnect-call', { token: 'valid-token' });

      // Visitor disconnects
      visitorWs.handlers.close();

      expect(agentWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"visitor disconnected"')
      );
    });

    test('fires webhook on call end', () => {
      const visitorWs = simulateConnection('visitor', 'webhook-call', { extension: 'ext-1' });
      simulateConnection('agent', 'webhook-call', { token: 'valid-token' });

      // Start call then hangup
      visitorWs.handlers.message(JSON.stringify({ type: 'start_call' }));
      visitorWs.handlers.message(JSON.stringify({ type: 'hangup' }));

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
    test('handles invalid JSON in message', () => {
      const visitorWs = simulateConnection('visitor', 'json-err', { extension: 'ext-1' });
      // Should not throw
      expect(() => visitorWs.handlers.message('not-json')).not.toThrow();
    });

    test('handles register signal type', () => {
      const visitorWs = simulateConnection('visitor', 'register-test', { extension: 'ext-1' });
      // Should not throw
      visitorWs.handlers.message(JSON.stringify({ type: 'register' }));
    });

    test('handles unknown signal type gracefully', () => {
      const visitorWs = simulateConnection('visitor', 'unknown-sig', { extension: 'ext-1' });
      expect(() => {
        visitorWs.handlers.message(JSON.stringify({ type: 'totally_unknown' }));
      }).not.toThrow();
    });
  });
});
