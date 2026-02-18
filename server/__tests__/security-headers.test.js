const { securityHeaders } = require('../middleware/security-headers');

describe('Security Headers Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = { setHeader: jest.fn() };
    next = jest.fn();
  });

  test('sets X-Content-Type-Options', () => {
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(next).toHaveBeenCalled();
  });

  test('sets X-Frame-Options', () => {
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'SAMEORIGIN');
  });

  test('sets Referrer-Policy', () => {
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
  });

  test('sets Content-Security-Policy', () => {
    securityHeaders(req, res, next);
    const cspCall = res.setHeader.mock.calls.find(c => c[0] === 'Content-Security-Policy');
    expect(cspCall).toBeTruthy();
    expect(cspCall[1]).toContain("default-src 'self'");
    expect(cspCall[1]).toContain("script-src 'self'");
  });

  test('sets Permissions-Policy', () => {
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  });

  test('calls next()', () => {
    securityHeaders(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
