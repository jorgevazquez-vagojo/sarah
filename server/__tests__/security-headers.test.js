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

  test('sets X-Permitted-Cross-Domain-Policies', () => {
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('X-Permitted-Cross-Domain-Policies', 'none');
  });

  test('sets Cross-Origin-Opener-Policy', () => {
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('Cross-Origin-Opener-Policy', 'same-origin');
  });

  test('sets Cross-Origin-Resource-Policy', () => {
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('Cross-Origin-Resource-Policy', 'same-origin');
  });

  test('sets X-DNS-Prefetch-Control', () => {
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('X-DNS-Prefetch-Control', 'off');
  });

  test('sets Origin-Agent-Cluster', () => {
    securityHeaders(req, res, next);
    expect(res.setHeader).toHaveBeenCalledWith('Origin-Agent-Cluster', '?1');
  });

  test('calls next()', () => {
    securityHeaders(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
