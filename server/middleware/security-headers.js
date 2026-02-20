// Security headers middleware (CSP, HSTS, etc.) — Helmet-equivalent without the dependency
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0'); // Modern browsers use CSP instead
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Origin-Agent-Cluster', '?1');

  // noindex — staging/tunnel only
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  // CSP: allow inline scripts/styles for the corporate page + widget Shadow DOM
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
  const connectSrc = ["'self'", 'wss:', 'ws:', ...allowedOrigins].join(' ');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src ${connectSrc}`,
    "img-src 'self' data: https:",
    "media-src 'self' blob:",
    "frame-ancestors 'self' " + allowedOrigins.join(' '),
  ].join('; '));

  next();
}

module.exports = { securityHeaders };
