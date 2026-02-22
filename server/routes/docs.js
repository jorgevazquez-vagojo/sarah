/**
 * API Documentation Routes — Serves Swagger UI and OpenAPI spec
 *
 * GET /api/docs          → Swagger UI (interactive API explorer)
 * GET /api/docs/openapi.yaml → Raw OpenAPI 3.0 YAML spec
 */

const { Router } = require('express');
const path = require('path');
const fs = require('fs');

const router = Router();

const OPENAPI_PATH = path.join(__dirname, '..', 'docs', 'openapi.yaml');

// ─── Serve OpenAPI YAML spec ───
router.get('/openapi.yaml', (_req, res) => {
  if (!fs.existsSync(OPENAPI_PATH)) {
    return res.status(404).json({ error: 'OpenAPI spec not found' });
  }
  res.setHeader('Content-Type', 'application/x-yaml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  fs.createReadStream(OPENAPI_PATH).pipe(res);
});

// ─── Serve Swagger UI (CDN-based, zero dependencies) ───
router.get('/', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sarah API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *::before, *::after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 30px 0; }
    .swagger-ui .info .title { font-size: 28px; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/docs/openapi.yaml',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset
      ],
      layout: 'BaseLayout',
      defaultModelsExpandDepth: 1,
      docExpansion: 'list',
      filter: true,
      tryItOutEnabled: true,
    });
  </script>
</body>
</html>`);
});

module.exports = router;
