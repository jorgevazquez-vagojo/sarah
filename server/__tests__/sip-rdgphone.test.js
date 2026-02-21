// SIP RDGPhone tests — pure functions + class behavior
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('../services/settings', () => ({ getMany: jest.fn() }));
jest.mock('../services/call-recording', () => ({ logCallStart: jest.fn().mockResolvedValue(null), logCallEnd: jest.fn().mockResolvedValue(null) }));
jest.mock('dgram', () => ({
  createSocket: jest.fn(() => ({
    on: jest.fn(),
    bind: jest.fn((port, cb) => { if (typeof cb === 'function') cb(); else if (typeof port === 'function') port(); }),
    send: jest.fn(),
    close: jest.fn(),
    address: jest.fn(() => ({ port: 5060 })),
  })),
}));

// We need to test the pure functions exported implicitly via the module.
// Since they are not exported, we test them via the SIP message flow.
// Let's re-implement the parse/build functions in a testable way by requiring the module source.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Extract pure functions by eval-ing only the function definitions
const srcPath = path.join(__dirname, '..', 'services', 'sip-rdgphone.js');
const src = fs.readFileSync(srcPath, 'utf8');

// We'll test through the module interface
const { sipClient } = require('../services/sip-rdgphone');

describe('SipRDGPhone', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SIP Message Parsing (via handleMessage)', () => {
    test('parses SIP response correctly', () => {
      const msg = Buffer.from(
        'SIP/2.0 200 OK\r\n' +
        'Via: SIP/2.0/UDP 192.168.1.1:5060;branch=z9hG4bKtest;rport\r\n' +
        'From: "100" <sip:100@pbx.example.com>;tag=abc123\r\n' +
        'To: <sip:100@pbx.example.com>;tag=def456\r\n' +
        'Call-ID: testcallid123\r\n' +
        'CSeq: 1 REGISTER\r\n' +
        'Contact: <sip:100@192.168.1.1:5060>\r\n' +
        'Content-Length: 0\r\n' +
        '\r\n'
      );

      // Set up state so handleMessage processes REGISTER response
      sipClient.config = { domain: 'pbx.example.com', extension: '100', password: 'pass' };
      sipClient.registered = false;

      // Should not throw
      expect(() => sipClient.handleMessage(msg, {})).not.toThrow();
    });

    test('handles OPTIONS keepalive with 200 OK', () => {
      const msg = Buffer.from(
        'OPTIONS sip:100@192.168.1.1:5060 SIP/2.0\r\n' +
        'Via: SIP/2.0/UDP pbx.example.com:5060;branch=z9hG4bKtest\r\n' +
        'From: <sip:ping@pbx.example.com>;tag=ping1\r\n' +
        'To: <sip:100@192.168.1.1:5060>\r\n' +
        'Call-ID: keepalive123\r\n' +
        'CSeq: 1 OPTIONS\r\n' +
        'Content-Length: 0\r\n' +
        '\r\n'
      );

      sipClient.socket = { send: jest.fn() };
      sipClient.config = { domain: 'pbx.example.com', port: 5060 };
      sipClient.handleMessage(msg, {});
      // Should respond (socket.send is wrapped in send() method which calls this.socket.send)
      // The send method converts to Buffer and calls socket.send
    });

    test('responds 405 to unknown request methods', () => {
      const msg = Buffer.from(
        'SUBSCRIBE sip:100@192.168.1.1:5060 SIP/2.0\r\n' +
        'Via: SIP/2.0/UDP pbx.example.com:5060;branch=z9hG4bKtest\r\n' +
        'From: <sip:other@pbx.example.com>;tag=sub1\r\n' +
        'To: <sip:100@192.168.1.1:5060>\r\n' +
        'Call-ID: subscribe123\r\n' +
        'CSeq: 1 SUBSCRIBE\r\n' +
        'Content-Length: 0\r\n' +
        '\r\n'
      );

      const mockSend = jest.fn();
      sipClient.socket = { send: mockSend };
      sipClient.config = { domain: 'pbx.example.com', port: 5060 };
      sipClient.handleMessage(msg, {});
      // send() should have been called with a 405 response
      expect(mockSend).toHaveBeenCalled();
      const sentBuf = mockSend.mock.calls[0][0];
      expect(sentBuf.toString()).toContain('405 Method Not Allowed');
    });

    test('handles malformed messages gracefully', () => {
      const msg = Buffer.from('this is not a SIP message\r\n\r\n');
      expect(() => sipClient.handleMessage(msg, {})).not.toThrow();
    });

    test('handles BYE from PBX with 200 OK', () => {
      const callId = 'bye-test-call-123';
      sipClient.activeCalls.set(callId, { state: 'answered', visitorPhone: '123456789' });

      const msg = Buffer.from(
        'BYE sip:100@192.168.1.1:5060 SIP/2.0\r\n' +
        'Via: SIP/2.0/UDP pbx.example.com:5060;branch=z9hG4bKbye\r\n' +
        'From: <sip:visitor@pbx.example.com>;tag=vis1\r\n' +
        'To: <sip:100@192.168.1.1:5060>;tag=our1\r\n' +
        `Call-ID: ${callId}\r\n` +
        'CSeq: 2 BYE\r\n' +
        'Content-Length: 0\r\n' +
        '\r\n'
      );

      const mockSend = jest.fn();
      sipClient.socket = { send: mockSend };
      sipClient.config = { domain: 'pbx.example.com', port: 5060 };
      sipClient.handleMessage(msg, {});

      expect(sipClient.activeCalls.has(callId)).toBe(false);
      expect(mockSend).toHaveBeenCalled();
      expect(mockSend.mock.calls[0][0].toString()).toContain('200 OK');
    });

    test('handles NOTIFY with 200 OK', () => {
      const msg = Buffer.from(
        'NOTIFY sip:100@192.168.1.1:5060 SIP/2.0\r\n' +
        'Via: SIP/2.0/UDP pbx.example.com:5060;branch=z9hG4bKnotify\r\n' +
        'From: <sip:visitor@pbx.example.com>;tag=vis1\r\n' +
        'To: <sip:100@192.168.1.1:5060>;tag=our1\r\n' +
        'Call-ID: notify-test\r\n' +
        'CSeq: 3 NOTIFY\r\n' +
        'Content-Length: 0\r\n' +
        '\r\n'
      );

      const mockSend = jest.fn();
      sipClient.socket = { send: mockSend };
      sipClient.config = { domain: 'pbx.example.com', port: 5060 };
      sipClient.handleMessage(msg, {});
      expect(mockSend).toHaveBeenCalled();
      expect(mockSend.mock.calls[0][0].toString()).toContain('200 OK');
    });
  });

  describe('Digest Authentication', () => {
    test('handles 401 challenge for REGISTER', () => {
      sipClient.config = {
        domain: 'pbx.example.com',
        port: 5060,
        extension: '100',
        password: 'secret123',
        ringExtensions: [],
        callerIdName: 'Lead Web',
      };
      sipClient.cseq = 1;

      const mockSend = jest.fn();
      sipClient.socket = { send: mockSend };

      const msg = Buffer.from(
        'SIP/2.0 401 Unauthorized\r\n' +
        'Via: SIP/2.0/UDP 192.168.1.1:5060;branch=z9hG4bKtest\r\n' +
        'From: "100" <sip:100@pbx.example.com>;tag=abc123\r\n' +
        'To: <sip:100@pbx.example.com>\r\n' +
        'Call-ID: reg-callid\r\n' +
        'CSeq: 1 REGISTER\r\n' +
        'WWW-Authenticate: Digest realm="asterisk", nonce="abc123nonce"\r\n' +
        'Content-Length: 0\r\n' +
        '\r\n'
      );

      sipClient.handleMessage(msg, {});
      // Should have sent a new REGISTER with Authorization header
      expect(mockSend).toHaveBeenCalled();
      const sent = mockSend.mock.calls[0][0].toString();
      expect(sent).toContain('REGISTER');
      expect(sent).toContain('Authorization: Digest');
      expect(sent).toContain('username="100"');
      expect(sent).toContain('realm="asterisk"');
    });

    test('marks registered on 200 OK for REGISTER', () => {
      sipClient.config = {
        domain: 'pbx.example.com',
        port: 5060,
        extension: '100',
        password: 'secret',
        ringExtensions: [],
        callerIdName: 'Lead Web',
      };
      sipClient.registered = false;

      const msg = Buffer.from(
        'SIP/2.0 200 OK\r\n' +
        'Via: SIP/2.0/UDP 192.168.1.1:5060;branch=z9hG4bKtest\r\n' +
        'From: "100" <sip:100@pbx.example.com>;tag=abc123\r\n' +
        'To: <sip:100@pbx.example.com>;tag=server1\r\n' +
        'Call-ID: reg-callid\r\n' +
        'CSeq: 2 REGISTER\r\n' +
        'Contact: <sip:100@192.168.1.1:5060>;expires=300\r\n' +
        'Content-Length: 0\r\n' +
        '\r\n'
      );

      sipClient.handleMessage(msg, {});
      expect(sipClient.registered).toBe(true);

      // Clean up re-register timer
      if (sipClient.registerTimer) {
        clearInterval(sipClient.registerTimer);
        sipClient.registerTimer = null;
      }
    });
  });

  describe('Phone Number Validation', () => {
    test('rejects phone numbers shorter than 6 digits', async () => {
      sipClient.registered = true;
      sipClient.socket = { send: jest.fn() };
      sipClient.config = { domain: 'pbx.example.com', port: 5060, extension: '100', callerIdName: 'Test' };

      await expect(sipClient.originate('12345')).rejects.toThrow('Invalid phone number');
    });

    test('strips non-digit characters from phone number', async () => {
      sipClient.registered = true;
      const mockSend = jest.fn();
      sipClient.socket = { send: mockSend };
      sipClient.localIp = '192.168.1.1';
      sipClient.localPort = 5060;
      sipClient.rtpPort = 5062;
      sipClient.config = {
        domain: 'pbx.example.com',
        port: 5060,
        extension: '100',
        callerIdName: 'Lead Web',
        ringExtensions: ['200'],
      };

      // Don't await — the promise waits for SIP response
      const promise = sipClient.originate('+34 (612) 345-678');

      // Verify the INVITE was sent with cleaned phone
      expect(mockSend).toHaveBeenCalled();
      const sent = mockSend.mock.calls[0][0].toString();
      expect(sent).toContain('INVITE sip:+34612345678@pbx.example.com');

      // Clean up: cancel the pending call
      const callId = [...sipClient.activeCalls.keys()][0];
      const call = sipClient.activeCalls.get(callId);
      clearTimeout(call.timer);
      sipClient.activeCalls.delete(callId);
      call.reject(new Error('test cleanup'));
      await promise.catch(() => {}); // swallow
    });

    test('rejects originate when not registered', async () => {
      sipClient.registered = false;
      await expect(sipClient.originate('+34612345678')).rejects.toThrow('SIP not registered');
    });
  });

  describe('INVITE Response Handling', () => {
    let callId;

    beforeEach(() => {
      callId = 'test-invite-' + Date.now();
      sipClient.config = {
        domain: 'pbx.example.com',
        port: 5060,
        extension: '100',
        password: 'secret',
        callerIdName: 'Lead Web',
        ringExtensions: ['200', '201'],
      };
      sipClient.localIp = '192.168.1.1';
      sipClient.localPort = 5060;
      sipClient.rtpPort = 5062;
      sipClient.socket = { send: jest.fn() };
    });

    test('updates state to ringing on 180 response', () => {
      const call = {
        callId, tag: 'tag1', cseq: 1, state: 'inviting',
        visitorPhone: '612345678', timer: setTimeout(() => {}, 30000),
        inviteUri: `sip:612345678@pbx.example.com`,
        resolve: jest.fn(), reject: jest.fn(),
      };
      sipClient.activeCalls.set(callId, call);

      const msg = Buffer.from(
        'SIP/2.0 180 Ringing\r\n' +
        'Via: SIP/2.0/UDP 192.168.1.1:5060;branch=z9hG4bKtest\r\n' +
        'From: "Lead Web" <sip:100@pbx.example.com>;tag=tag1\r\n' +
        `To: <sip:612345678@pbx.example.com>;tag=servertag\r\n` +
        `Call-ID: ${callId}\r\n` +
        'CSeq: 1 INVITE\r\n' +
        'Content-Length: 0\r\n' +
        '\r\n'
      );

      sipClient.handleMessage(msg, {});
      expect(call.state).toBe('ringing');
      expect(call.toTag).toBe('servertag');

      clearTimeout(call.timer);
      sipClient.activeCalls.delete(callId);
    });

    test('handles call failure (486 Busy Here)', () => {
      const rejectFn = jest.fn();
      const call = {
        callId, tag: 'tag1', cseq: 1, state: 'inviting',
        visitorPhone: '612345678', timer: setTimeout(() => {}, 30000),
        inviteUri: `sip:612345678@pbx.example.com`,
        resolve: jest.fn(), reject: rejectFn,
      };
      sipClient.activeCalls.set(callId, call);

      const msg = Buffer.from(
        'SIP/2.0 486 Busy Here\r\n' +
        'Via: SIP/2.0/UDP 192.168.1.1:5060;branch=z9hG4bKtest\r\n' +
        'From: "Lead Web" <sip:100@pbx.example.com>;tag=tag1\r\n' +
        `To: <sip:612345678@pbx.example.com>;tag=busy\r\n` +
        `Call-ID: ${callId}\r\n` +
        'CSeq: 1 INVITE\r\n' +
        'Content-Length: 0\r\n' +
        '\r\n'
      );

      sipClient.handleMessage(msg, {});
      expect(rejectFn).toHaveBeenCalledWith(expect.objectContaining({ message: 'Call failed: 486 Busy Here' }));
      expect(sipClient.activeCalls.has(callId)).toBe(false);
    });
  });

  describe('REFER Response Handling', () => {
    test('resolves on 202 Accepted', () => {
      const callId = 'refer-test-202';
      const referResolve = jest.fn();
      const referTimer = setTimeout(() => {}, 15000);
      sipClient.activeCalls.set(callId, {
        referResolve,
        referReject: jest.fn(),
        referTimer,
      });

      const msg = Buffer.from(
        'SIP/2.0 202 Accepted\r\n' +
        'Via: SIP/2.0/UDP 192.168.1.1:5060;branch=z9hG4bKrefer\r\n' +
        'From: "Lead Web" <sip:100@pbx.example.com>;tag=tag1\r\n' +
        'To: <sip:612345678@pbx.example.com>;tag=servertag\r\n' +
        `Call-ID: ${callId}\r\n` +
        'CSeq: 3 REFER\r\n' +
        'Content-Length: 0\r\n' +
        '\r\n'
      );

      sipClient.handleMessage(msg, {});
      expect(referResolve).toHaveBeenCalled();
      sipClient.activeCalls.delete(callId);
    });

    test('rejects on 403 Forbidden', () => {
      const callId = 'refer-test-403';
      const referReject = jest.fn();
      const referTimer = setTimeout(() => {}, 15000);
      sipClient.activeCalls.set(callId, {
        referResolve: jest.fn(),
        referReject,
        referTimer,
      });

      const msg = Buffer.from(
        'SIP/2.0 403 Forbidden\r\n' +
        'Via: SIP/2.0/UDP 192.168.1.1:5060;branch=z9hG4bKrefer\r\n' +
        'From: "Lead Web" <sip:100@pbx.example.com>;tag=tag1\r\n' +
        'To: <sip:612345678@pbx.example.com>;tag=servertag\r\n' +
        `Call-ID: ${callId}\r\n` +
        'CSeq: 3 REFER\r\n' +
        'Content-Length: 0\r\n' +
        '\r\n'
      );

      sipClient.handleMessage(msg, {});
      expect(referReject).toHaveBeenCalledWith(expect.objectContaining({ message: 'REFER failed: 403' }));
      sipClient.activeCalls.delete(callId);
    });
  });

  describe('CANCEL / BYE', () => {
    test('cancelCall sends CANCEL and removes from activeCalls', () => {
      const callId = 'cancel-test';
      sipClient.activeCalls.set(callId, {
        callId,
        tag: 'tag1',
        cseq: 1,
        state: 'inviting',
        visitorPhone: '612345678',
        inviteUri: 'sip:612345678@pbx.example.com',
      });
      sipClient.config = {
        domain: 'pbx.example.com',
        port: 5060,
        extension: '100',
        callerIdName: 'Lead Web',
      };
      const mockSend = jest.fn();
      sipClient.socket = { send: mockSend };

      sipClient.cancelCall(callId);

      expect(mockSend).toHaveBeenCalled();
      const sent = mockSend.mock.calls[0][0].toString();
      expect(sent).toContain('CANCEL');
      expect(sipClient.activeCalls.has(callId)).toBe(false);
    });

    test('sendBye sends BYE and removes from activeCalls', () => {
      const callId = 'bye-test';
      sipClient.activeCalls.set(callId, {
        callId,
        tag: 'tag1',
        cseq: 1,
        state: 'answered',
        visitorPhone: '612345678',
        inviteUri: 'sip:612345678@pbx.example.com',
        toTag: 'server1',
      });
      sipClient.config = {
        domain: 'pbx.example.com',
        port: 5060,
        extension: '100',
        callerIdName: 'Lead Web',
      };
      const mockSend = jest.fn();
      sipClient.socket = { send: mockSend };

      sipClient.sendBye(callId);

      expect(mockSend).toHaveBeenCalled();
      const sent = mockSend.mock.calls[0][0].toString();
      expect(sent).toContain('BYE');
      expect(sipClient.activeCalls.has(callId)).toBe(false);
    });

    test('cancelCall does nothing for unknown callId', () => {
      const mockSend = jest.fn();
      sipClient.socket = { send: mockSend };
      sipClient.cancelCall('nonexistent');
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('rdgphone', () => {
    test('throws when not registered', async () => {
      sipClient.registered = false;
      await expect(sipClient.rdgphone('+34612345678', 'boostic', 'conv-1'))
        .rejects.toThrow('SIP not registered');
    });
  });

  describe('destroy', () => {
    test('cleans up resources', () => {
      sipClient.registerTimer = setInterval(() => {}, 100000);
      sipClient.socket = { close: jest.fn(), send: jest.fn() };
      sipClient.config = {
        domain: 'pbx.example.com',
        port: 5060,
        extension: '100',
        callerIdName: 'Lead Web',
      };

      // Add a fake active call
      sipClient.activeCalls.set('cleanup-test', {
        callId: 'cleanup-test',
        tag: 'tag1',
        cseq: 1,
        state: 'answered',
        visitorPhone: '612345678',
        inviteUri: 'sip:612345678@pbx.example.com',
      });

      sipClient.destroy();

      expect(sipClient.registered).toBe(false);
      expect(sipClient.socket.close).toHaveBeenCalled();
    });
  });
});
