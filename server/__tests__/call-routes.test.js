// Call Routes tests
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('../utils/db', () => ({
  db: {
    query: jest.fn(),
    getConversation: jest.fn(),
    createCall: jest.fn(),
    updateCall: jest.fn(),
  },
}));
jest.mock('../services/sip-manager', () => ({
  generateSipCredentials: jest.fn((visitorId) => ({
    extension: `visitor-${visitorId}`,
    password: 'generated-pass',
    domain: 'pbx.example.com',
  })),
}));
jest.mock('../services/queue-manager', () => ({
  getQueueName: jest.fn((bl) => `queue-${bl}`),
}));
jest.mock('../services/router', () => ({
  isBusinessHours: jest.fn(() => true),
}));
jest.mock('../services/call-recording', () => ({
  getCallRecordings: jest.fn().mockResolvedValue([]),
  getCallDetail: jest.fn().mockResolvedValue(null),
  getCallStats: jest.fn().mockResolvedValue({ total_calls: 0 }),
  saveRecording: jest.fn().mockResolvedValue('/api/calls/recordings/test.wav'),
  transcribeCall: jest.fn().mockResolvedValue('Transcribed text'),
  startMonitoring: jest.fn().mockResolvedValue(null),
  stopMonitoring: jest.fn().mockResolvedValue(null),
  cleanupOldRecordings: jest.fn().mockResolvedValue({ filesDeleted: 0 }),
  RECORDINGS_DIR: '/tmp/test-recordings',
}));
jest.mock('../services/sip-click2call', () => ({
  sipClient: {
    registered: true,
    config: { domain: 'pbx.example.com', extension: '100' },
  },
}));
jest.mock('../middleware/auth', () => ({
  requireApiKey: (req, res, next) => next(),
  requireAgent: (req, res, next) => {
    req.agent = { id: 'agent-1', role: 'admin', name: 'Test Agent' };
    next();
  },
}));
jest.mock('../middleware/error-handler', () => ({
  asyncRoute: (fn) => (req, res, next) => fn(req, res, next).catch(next),
}));
jest.mock('multer', () => {
  const multer = () => ({
    single: () => (req, res, next) => {
      req.file = req._mockFile || null;
      next();
    },
  });
  return multer;
});

const express = require('express');
const request = require('supertest');
const { db } = require('../utils/db');
const callRecording = require('../services/call-recording');

// Build test app
let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/calls', require('../routes/call'));
  // Error handler
  app.use((err, req, res, _next) => {
    res.status(500).json({ error: err.message });
  });
});

describe('Call Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/calls/credentials', () => {
    test('returns SIP credentials for visitor', async () => {
      db.createCall.mockResolvedValue({ id: 'call-123' });

      const res = await request(app)
        .post('/api/calls/credentials')
        .send({ visitorId: 'v1', conversationId: 'conv-1' });

      expect(res.status).toBe(200);
      expect(res.body.callId).toBe('call-123');
      expect(res.body.sip).toBeDefined();
      expect(res.body.sip.extension).toContain('visitor-v1');
    });

    test('returns 400 without visitorId', async () => {
      const res = await request(app)
        .post('/api/calls/credentials')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('visitorId required');
    });

    test('resolves queue by business line', async () => {
      db.getConversation.mockResolvedValue({ business_line: 'tech' });
      db.createCall.mockResolvedValue({ id: 'call-q' });

      const res = await request(app)
        .post('/api/calls/credentials')
        .send({ visitorId: 'v2', conversationId: 'conv-2' });

      expect(res.status).toBe(200);
      expect(res.body.queue).toBe('queue-tech');
    });
  });

  describe('POST /api/calls/:id/end', () => {
    test('ends call with duration', async () => {
      db.updateCall.mockResolvedValue({ rowCount: 1 });

      const res = await request(app)
        .post('/api/calls/call-1/end')
        .send({ duration: 120 });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(db.updateCall).toHaveBeenCalledWith('call-1', expect.objectContaining({
        status: 'ended',
        duration_seconds: 120,
      }));
    });

    test('ends call without duration', async () => {
      db.updateCall.mockResolvedValue({ rowCount: 1 });

      const res = await request(app)
        .post('/api/calls/call-2/end')
        .send({});

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/calls/stats', () => {
    test('returns call statistics', async () => {
      callRecording.getCallStats.mockResolvedValue({
        total_calls: 42,
        active_calls: 2,
      });

      const res = await request(app)
        .get('/api/calls/stats');

      expect(res.status).toBe(200);
      expect(res.body.total_calls).toBe(42);
    });
  });

  describe('GET /api/calls/recordings', () => {
    test('returns recording list', async () => {
      callRecording.getCallRecordings.mockResolvedValue([
        { id: 1, call_id: 'c1', status: 'ended' },
      ]);

      const res = await request(app)
        .get('/api/calls/recordings');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    test('passes filter params', async () => {
      callRecording.getCallRecordings.mockResolvedValue([]);

      await request(app)
        .get('/api/calls/recordings?businessLine=tech&status=active&limit=10&offset=5');

      expect(callRecording.getCallRecordings).toHaveBeenCalledWith({
        businessLine: 'tech',
        status: 'active',
        limit: 10,
        offset: 5,
      });
    });
  });

  describe('GET /api/calls/recordings/:callId', () => {
    test('returns call detail', async () => {
      callRecording.getCallDetail.mockResolvedValue({ call_id: 'c1', transcript: 'Hello' });

      const res = await request(app)
        .get('/api/calls/recordings/c1');

      expect(res.status).toBe(200);
      expect(res.body.call_id).toBe('c1');
    });

    test('returns 404 for unknown call', async () => {
      callRecording.getCallDetail.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/calls/recordings/unknown');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/calls/recordings/:callId/transcribe', () => {
    test('returns transcript', async () => {
      callRecording.transcribeCall.mockResolvedValue('Hello, how can I help?');

      const res = await request(app)
        .post('/api/calls/recordings/c1/transcribe');

      expect(res.status).toBe(200);
      expect(res.body.transcript).toBe('Hello, how can I help?');
    });
  });

  describe('POST /api/calls/recordings/:callId/monitor', () => {
    test('starts monitoring active call', async () => {
      callRecording.getCallDetail.mockResolvedValue({
        call_id: 'c1',
        status: 'active',
        agent_extension: '200',
      });

      const res = await request(app)
        .post('/api/calls/recordings/c1/monitor');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.sipUri).toContain('*1200');
    });

    test('rejects monitoring inactive call', async () => {
      callRecording.getCallDetail.mockResolvedValue({
        call_id: 'c1',
        status: 'ended',
      });

      const res = await request(app)
        .post('/api/calls/recordings/c1/monitor');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('not active');
    });

    test('returns 404 for unknown call', async () => {
      callRecording.getCallDetail.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/calls/recordings/unknown/monitor');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/calls/recordings/:callId/monitor/stop', () => {
    test('stops monitoring', async () => {
      const res = await request(app)
        .post('/api/calls/recordings/c1/monitor/stop');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(callRecording.stopMonitoring).toHaveBeenCalledWith('c1');
    });
  });

  describe('POST /api/calls/cleanup', () => {
    test('triggers cleanup for admin', async () => {
      callRecording.cleanupOldRecordings.mockResolvedValue({
        filesDeleted: 5,
        recordsCleaned: 10,
        recordsPurged: 3,
      });

      const res = await request(app)
        .post('/api/calls/cleanup');

      expect(res.status).toBe(200);
      expect(res.body.filesDeleted).toBe(5);
    });
  });
});
