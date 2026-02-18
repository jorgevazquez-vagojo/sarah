const { generateToken, verifyToken } = require('../middleware/auth');

describe('Auth', () => {
  const mockAgent = {
    id: 'agent-123',
    username: 'testuser',
    display_name: 'Test User',
  };

  describe('generateToken', () => {
    test('returns a JWT string', () => {
      const token = generateToken(mockAgent);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    test('generates different tokens for different agents', () => {
      const token1 = generateToken(mockAgent);
      const token2 = generateToken({ ...mockAgent, id: 'agent-456' });
      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyToken', () => {
    test('verifies a valid token', () => {
      const token = generateToken(mockAgent);
      const decoded = verifyToken(token);
      expect(decoded.id).toBe('agent-123');
      expect(decoded.username).toBe('testuser');
      expect(decoded.displayName).toBe('Test User');
    });

    test('throws on invalid token', () => {
      expect(() => verifyToken('invalid.token.here')).toThrow();
    });

    test('throws on empty string', () => {
      expect(() => verifyToken('')).toThrow();
    });

    test('throws on null', () => {
      expect(() => verifyToken(null)).toThrow();
    });

    test('token contains expiry', () => {
      const token = generateToken(mockAgent);
      const decoded = verifyToken(token);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      // Expires in ~12 hours
      expect(decoded.exp - decoded.iat).toBe(43200);
    });
  });

  describe('requireAgent middleware', () => {
    const { requireAgent } = require('../middleware/auth');

    test('rejects request without Authorization header', () => {
      const req = { headers: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireAgent(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('rejects request with invalid token', () => {
      const req = { headers: { authorization: 'Bearer invalid' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireAgent(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('accepts valid token and sets req.agent', () => {
      const token = generateToken(mockAgent);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireAgent(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.agent.id).toBe('agent-123');
    });
  });

  describe('requireRole middleware', () => {
    const { requireRole } = require('../middleware/auth');

    test('rejects when no agent on request', () => {
      const middleware = requireRole('admin');
      const req = {};
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('rejects when agent has wrong role', () => {
      const middleware = requireRole('admin', 'supervisor');
      const req = { agent: { id: '1', role: 'agent' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('allows matching role', () => {
      const middleware = requireRole('admin', 'architect');
      const req = { agent: { id: '1', role: 'architect' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('allows admin role for admin-only routes', () => {
      const middleware = requireRole('admin');
      const req = { agent: { id: '1', role: 'admin' } };
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('supports all new roles (architect, developer, qa)', () => {
      for (const role of ['architect', 'developer', 'qa']) {
        const middleware = requireRole(role);
        const req = { agent: { id: '1', role } };
        const res = {};
        const next = jest.fn();
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
      }
    });
  });

  describe('generateToken includes role', () => {
    test('includes role in JWT payload', () => {
      const agentWithRole = { ...mockAgent, role: 'architect' };
      const token = generateToken(agentWithRole);
      const decoded = verifyToken(token);
      expect(decoded.role).toBe('architect');
    });

    test('defaults to agent when role is missing', () => {
      const token = generateToken(mockAgent);
      const decoded = verifyToken(token);
      expect(decoded.role).toBe('agent');
    });
  });

  describe('requireApiKey middleware', () => {
    const { requireApiKey } = require('../middleware/auth');

    test('allows in development mode without key', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const req = { headers: {}, query: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireApiKey(req, res, next);

      expect(next).toHaveBeenCalled();
      process.env.NODE_ENV = originalEnv;
    });

    test('rejects in production without key', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const req = { headers: {}, query: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireApiKey(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      process.env.NODE_ENV = originalEnv;
    });

    test('accepts valid API key from header', () => {
      const originalKey = process.env.WIDGET_API_KEY;
      process.env.WIDGET_API_KEY = 'test-key-123';

      const req = { headers: { 'x-api-key': 'test-key-123' }, query: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireApiKey(req, res, next);

      expect(next).toHaveBeenCalled();
      process.env.WIDGET_API_KEY = originalKey;
    });

    test('accepts valid API key from query param', () => {
      const originalKey = process.env.WIDGET_API_KEY;
      process.env.WIDGET_API_KEY = 'test-key-123';

      const req = { headers: {}, query: { apiKey: 'test-key-123' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      requireApiKey(req, res, next);

      expect(next).toHaveBeenCalled();
      process.env.WIDGET_API_KEY = originalKey;
    });
  });
});
