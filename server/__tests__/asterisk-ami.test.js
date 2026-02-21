// Asterisk AMI Client tests
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('../services/settings', () => ({ getMany: jest.fn() }));

// Mock net module
const mockSocket = {
  setEncoding: jest.fn(),
  on: jest.fn(),
  write: jest.fn(),
  destroy: jest.fn(),
  destroyed: false,
};
jest.mock('net', () => ({
  createConnection: jest.fn((opts, cb) => {
    if (cb) setTimeout(cb, 0);
    return mockSocket;
  }),
}));

const { ami } = require('../services/asterisk-ami');

describe('AsteriskAMI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ami.connected = false;
    ami.buffer = '';
    ami.actionIdCounter = 0;
    ami.pendingActions.clear();
    mockSocket.destroyed = false;
  });

  describe('processBuffer', () => {
    test('parses single AMI packet', () => {
      const handler = jest.fn();
      ami.on('event', handler);

      ami.buffer = 'Event: Hangup\r\nChannel: SIP/100\r\nCause: 16\r\n\r\n';
      ami.processBuffer();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          Event: 'Hangup',
          Channel: 'SIP/100',
          Cause: '16',
        })
      );
      ami.removeListener('event', handler);
    });

    test('parses multiple AMI packets in one buffer', () => {
      const events = [];
      const handler = (evt) => events.push(evt);
      ami.on('event', handler);

      ami.buffer =
        'Event: Newchannel\r\nChannel: SIP/100\r\n\r\n' +
        'Event: Hangup\r\nChannel: SIP/100\r\n\r\n';
      ami.processBuffer();

      expect(events).toHaveLength(2);
      expect(events[0].Event).toBe('Newchannel');
      expect(events[1].Event).toBe('Hangup');
      ami.removeListener('event', handler);
    });

    test('handles partial packets (incomplete buffer)', () => {
      const handler = jest.fn();
      ami.on('event', handler);

      ami.buffer = 'Event: PartialEvent\r\nChannel: SIP/100';
      ami.processBuffer();

      // Should not emit — packet incomplete
      expect(handler).not.toHaveBeenCalled();
      // Remaining buffer should be kept
      expect(ami.buffer).toBe('Event: PartialEvent\r\nChannel: SIP/100');
      ami.removeListener('event', handler);
    });

    test('resolves pending actions by ActionID', () => {
      const resolveFn = jest.fn();
      ami.pendingActions.set('chatbot-1', { resolve: resolveFn, reject: jest.fn() });

      ami.buffer = 'Response: Success\r\nActionID: chatbot-1\r\nMessage: Originate OK\r\n\r\n';
      ami.processBuffer();

      expect(resolveFn).toHaveBeenCalledWith(
        expect.objectContaining({
          Response: 'Success',
          ActionID: 'chatbot-1',
          Message: 'Originate OK',
        })
      );
      expect(ami.pendingActions.has('chatbot-1')).toBe(false);
    });

    test('emits banner event for Asterisk greeting', () => {
      const handler = jest.fn();
      ami.on('banner', handler);

      ami.buffer = 'Asterisk Call Manager/5.0.1\r\n\r\n';
      ami.processBuffer();

      expect(handler).toHaveBeenCalled();
      ami.removeListener('banner', handler);
    });

    test('emits specific event type', () => {
      const handler = jest.fn();
      ami.on('event:Dial', handler);

      ami.buffer = 'Event: Dial\r\nDestination: SIP/200\r\n\r\n';
      ami.processBuffer();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ Event: 'Dial', Destination: 'SIP/200' })
      );
      ami.removeListener('event:Dial', handler);
    });

    test('skips empty packets', () => {
      const handler = jest.fn();
      ami.on('event', handler);

      ami.buffer = '\r\n\r\n\r\n\r\n';
      ami.processBuffer();

      expect(handler).not.toHaveBeenCalled();
      ami.removeListener('event', handler);
    });
  });

  describe('sendAction', () => {
    test('rejects when socket is not connected', async () => {
      ami.socket = null;
      await expect(ami.sendAction({ Action: 'Test' })).rejects.toThrow('AMI not connected');
    });

    test('rejects when socket is destroyed', async () => {
      ami.socket = { ...mockSocket, destroyed: true };
      await expect(ami.sendAction({ Action: 'Test' })).rejects.toThrow('AMI not connected');
    });

    test('writes formatted AMI action to socket', async () => {
      ami.socket = mockSocket;
      mockSocket.destroyed = false;

      // Simulate immediate response
      const actionPromise = ami.sendAction({ Action: 'Ping' });

      // Get the ActionID that was assigned
      const actionId = `chatbot-${ami.actionIdCounter}`;
      expect(ami.pendingActions.has(actionId)).toBe(true);

      // Verify write format
      expect(mockSocket.write).toHaveBeenCalled();
      const written = mockSocket.write.mock.calls[0][0];
      expect(written).toContain('Action: Ping');
      expect(written).toContain(`ActionID: ${actionId}`);
      expect(written).toMatch(/\r\n\r\n$/); // ends with double CRLF

      // Resolve the pending action
      const { resolve } = ami.pendingActions.get(actionId);
      resolve({ Response: 'Success', Ping: 'Pong' });

      const result = await actionPromise;
      expect(result.Response).toBe('Success');
    });

    test('action timeout after 10s', async () => {
      jest.useFakeTimers();
      ami.socket = mockSocket;
      mockSocket.destroyed = false;

      const promise = ami.sendAction({ Action: 'SlowAction' });

      jest.advanceTimersByTime(10001);

      await expect(promise).rejects.toThrow('AMI action timeout');
      jest.useRealTimers();
    });
  });

  describe('originate', () => {
    test('rejects when not connected', async () => {
      ami.connected = false;
      await expect(ami.originate({
        visitorPhone: '+34612345678',
        callId: 'test',
        extension: '200',
      })).rejects.toThrow('AMI not connected');
    });

    test('rejects invalid phone number', async () => {
      ami.connected = true;
      const settings = require('../services/settings');
      settings.getMany.mockResolvedValue({});

      await expect(ami.originate({
        visitorPhone: '123',
        callId: 'test',
        extension: '200',
      })).rejects.toThrow('Invalid phone number');
    });

    test('sends originate action with correct fields', async () => {
      ami.connected = true;
      ami.socket = mockSocket;
      mockSocket.destroyed = false;

      const settings = require('../services/settings');
      settings.getMany.mockResolvedValue({
        'rdgphone.extension': '100',
        'rdgphone.context': 'from-internal',
        'rdgphone.trunk': 'PJSIP/vozelia',
      });

      const originatePromise = ami.originate({
        visitorPhone: '+34 612 345 678',
        callId: 'call-abc',
        businessLine: 'boostic',
        visitorName: 'Juan',
      });

      // Wait for async settings.getMany to resolve and sendAction to fire
      await new Promise((r) => setTimeout(r, 10));

      // Get the action ID
      const actionId = `chatbot-${ami.actionIdCounter}`;
      const pending = ami.pendingActions.get(actionId);
      expect(pending).toBeDefined();

      // Verify the written action
      const written = mockSocket.write.mock.calls[0][0];
      expect(written).toContain('Action: Originate');
      expect(written).toContain('Channel: PJSIP/vozelia/+34612345678');
      expect(written).toContain('Context: from-internal');
      expect(written).toContain('Lead Web - Juan');
      expect(written).toContain('CALL_ID=call-abc');

      // Resolve with success
      pending.resolve({ Response: 'Success', ActionID: actionId });
      const result = await originatePromise;
      expect(result.success).toBe(true);
    });

    test('throws on originate failure', async () => {
      ami.connected = true;
      ami.socket = mockSocket;
      mockSocket.destroyed = false;

      const settings = require('../services/settings');
      settings.getMany.mockResolvedValue({});

      const promise = ami.originate({
        visitorPhone: '+34612345678',
        callId: 'call-fail',
      });

      // Wait for async settings.getMany to resolve
      await new Promise((r) => setTimeout(r, 10));

      const actionId = `chatbot-${ami.actionIdCounter}`;
      const pending = ami.pendingActions.get(actionId);
      expect(pending).toBeDefined();
      pending.resolve({ Response: 'Error', Message: 'Channel not available' });

      await expect(promise).rejects.toThrow('Channel not available');
    });

    test('uses business line for CallerID when no visitor name', async () => {
      ami.connected = true;
      ami.socket = mockSocket;
      mockSocket.destroyed = false;

      const settings = require('../services/settings');
      settings.getMany.mockResolvedValue({});

      const promise = ami.originate({
        visitorPhone: '+34612345678',
        callId: 'call-bl',
        businessLine: 'tech',
      });

      // Wait for async settings.getMany to resolve
      await new Promise((r) => setTimeout(r, 10));

      const written = mockSocket.write.mock.calls[0][0];
      expect(written).toContain('Lead Web - tech');

      const actionId = `chatbot-${ami.actionIdCounter}`;
      const pending = ami.pendingActions.get(actionId);
      expect(pending).toBeDefined();
      pending.resolve({ Response: 'Success' });
      await promise;
    });
  });

  describe('destroy', () => {
    test('cleans up socket and timers', () => {
      ami.reconnectTimer = setTimeout(() => {}, 100000);
      ami.socket = mockSocket;

      ami.destroy();

      expect(mockSocket.destroy).toHaveBeenCalled();
    });
  });
});
