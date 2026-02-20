const { csrfProtection } = require('../middleware/csrf');

describe('CSRF Protection Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { method: 'POST', headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  test('allows GET requests without origin', () => {
    req.method = 'GET';
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('allows HEAD requests without origin', () => {
    req.method = 'HEAD';
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('allows OPTIONS requests without origin', () => {
    req.method = 'OPTIONS';
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('allows requests with x-api-key header', () => {
    req.headers['x-api-key'] = 'some-key';
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('allows requests with x-requested-with header (AJAX)', () => {
    req.headers['x-requested-with'] = 'XMLHttpRequest';
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('allows JSON requests without origin (same-origin or API client)', () => {
    req.headers['content-type'] = 'application/json';
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('rejects POST without origin, referer, or JSON content-type', () => {
    req.headers['content-type'] = 'application/x-www-form-urlencoded';
    csrfProtection(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('allows request with matching origin', () => {
    const origEnv = process.env.ALLOWED_ORIGINS;
    process.env.ALLOWED_ORIGINS = 'https://example.com';
    req.headers.origin = 'https://example.com';
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
    process.env.ALLOWED_ORIGINS = origEnv;
  });

  test('rejects request with non-matching origin', () => {
    const origEnv = process.env.ALLOWED_ORIGINS;
    const origNode = process.env.NODE_ENV;
    process.env.ALLOWED_ORIGINS = 'https://example.com';
    process.env.NODE_ENV = 'production';
    req.headers.origin = 'https://evil.com';
    csrfProtection(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    process.env.ALLOWED_ORIGINS = origEnv;
    process.env.NODE_ENV = origNode;
  });

  test('allows PUT with valid origin', () => {
    const origEnv = process.env.ALLOWED_ORIGINS;
    process.env.ALLOWED_ORIGINS = 'https://mysite.com';
    req.method = 'PUT';
    req.headers.origin = 'https://mysite.com';
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
    process.env.ALLOWED_ORIGINS = origEnv;
  });

  test('allows DELETE with valid origin', () => {
    const origEnv = process.env.ALLOWED_ORIGINS;
    process.env.ALLOWED_ORIGINS = 'https://mysite.com';
    req.method = 'DELETE';
    req.headers.origin = 'https://mysite.com';
    csrfProtection(req, res, next);
    expect(next).toHaveBeenCalled();
    process.env.ALLOWED_ORIGINS = origEnv;
  });
});
