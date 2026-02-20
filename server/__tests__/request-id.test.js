const { requestId } = require('../middleware/request-id');

describe('Request ID Middleware', () => {
  test('generates a request ID when none provided', () => {
    const req = { headers: {} };
    const res = { setHeader: jest.fn() };
    const next = jest.fn();

    requestId(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(typeof req.requestId).toBe('string');
    expect(req.requestId.length).toBeGreaterThan(0);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.requestId);
    expect(next).toHaveBeenCalled();
  });

  test('uses existing x-request-id header if provided', () => {
    const req = { headers: { 'x-request-id': 'existing-id-123' } };
    const res = { setHeader: jest.fn() };
    const next = jest.fn();

    requestId(req, res, next);

    expect(req.requestId).toBe('existing-id-123');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'existing-id-123');
    expect(next).toHaveBeenCalled();
  });

  test('generates unique IDs for different requests', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      const req = { headers: {} };
      const res = { setHeader: jest.fn() };
      const next = jest.fn();
      requestId(req, res, next);
      ids.add(req.requestId);
    }
    expect(ids.size).toBe(100);
  });
});
