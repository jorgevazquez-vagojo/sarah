const { asyncRoute, errorHandler, notFoundHandler } = require('../middleware/error-handler');

describe('Error Handler Middleware', () => {
  describe('asyncRoute', () => {
    test('calls handler normally when no error', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      const wrapped = asyncRoute(handler);
      const req = {}, res = {}, next = jest.fn();
      await wrapped(req, res, next);
      expect(handler).toHaveBeenCalledWith(req, res, next);
    });

    test('passes errors to next() on rejection', async () => {
      const err = new Error('boom');
      const handler = jest.fn().mockRejectedValue(err);
      const wrapped = asyncRoute(handler);
      const req = {}, res = {}, next = jest.fn();
      await wrapped(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });

    test('catches sync throws', async () => {
      const err = new Error('sync boom');
      const handler = jest.fn(() => { throw err; });
      const wrapped = asyncRoute(handler);
      const req = {}, res = {}, next = jest.fn();
      await wrapped(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('errorHandler', () => {
    test('responds with 500 for generic errors', () => {
      const err = new Error('internal');
      const req = { method: 'GET', originalUrl: '/test' };
      const res = { headersSent: false, status: jest.fn().mockReturnThis(), json: jest.fn() };
      errorHandler(err, req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    test('uses err.status for client errors', () => {
      const err = new Error('bad request');
      err.status = 400;
      const req = { method: 'POST', originalUrl: '/api/test' };
      const res = { headersSent: false, status: jest.fn().mockReturnThis(), json: jest.fn() };
      errorHandler(err, req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'bad request' });
    });

    test('does not respond if headers already sent', () => {
      const err = new Error('late');
      const req = { method: 'GET', originalUrl: '/test' };
      const res = { headersSent: true, status: jest.fn(), json: jest.fn() };
      errorHandler(err, req, res, jest.fn());
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('notFoundHandler', () => {
    test('responds with 404', () => {
      const req = { method: 'GET', originalUrl: '/missing' };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      notFoundHandler(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Not found: GET /missing' });
    });
  });
});
