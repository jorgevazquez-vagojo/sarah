// CSRF protection: validate Origin header on state-changing requests
// This is a lightweight alternative to token-based CSRF — checks that the
// Origin or Referer header matches allowed origins for POST/PUT/PATCH/DELETE.

function csrfProtection(req, res, next) {
  // Only check state-changing methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // API key-authenticated requests (machine-to-machine) are exempt
  if (req.headers['x-api-key']) {
    return next();
  }

  // AJAX requests with custom headers are inherently CSRF-safe
  // (browsers block cross-origin custom headers without CORS preflight)
  if (req.headers['x-requested-with']) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // No origin/referer at all — could be same-origin (browsers omit for same-origin)
  // or a non-browser client. Allow if content-type is JSON (browsers send form-urlencoded for CSRF)
  if (!origin && !referer) {
    const ct = req.headers['content-type'] || '';
    if (ct.includes('application/json')) {
      return next();
    }
    return res.status(403).json({ error: 'CSRF validation failed: missing Origin header' });
  }

  // Validate origin against allowed list
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // In development, also allow localhost variations
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }

  const requestOrigin = origin || new URL(referer).origin;

  if (allowedOrigins.includes(requestOrigin)) {
    return next();
  }

  return res.status(403).json({ error: 'CSRF validation failed: origin not allowed' });
}

module.exports = { csrfProtection };
