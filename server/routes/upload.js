const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { db } = require('../utils/db');
const { logger } = require('../utils/logger');
const { requireApiKey } = require('../middleware/auth');

const router = Router();

// Require authentication on all upload routes
router.use(requireApiKey);

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
// SVG excluded — can contain embedded JS (XSS risk)
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
]);

// Ensure upload directory exists
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// File upload — accepts multipart/form-data with a single "file" field
router.post('/', async (req, res) => {
  try {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'multipart/form-data required' });
    }

    const chunks = [];
    let size = 0;

    await new Promise((resolve, reject) => {
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_SIZE) {
          reject(new Error('File too large'));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', resolve);
      req.on('error', reject);
    });

    const body = Buffer.concat(chunks);
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) return res.status(400).json({ error: 'Invalid multipart boundary' });

    // Parse multipart manually (lightweight, no dependency)
    const parsed = parseMultipart(body, boundary);
    if (!parsed) return res.status(400).json({ error: 'No file found in request' });

    const { filename: rawFilename, mimeType, data } = parsed;

    // Validate mime type
    if (!ALLOWED_TYPES.has(mimeType)) {
      return res.status(400).json({ error: `File type ${mimeType} not allowed` });
    }

    // Double-check: block SVG even if MIME sniffing is wrong
    const lowerFilename = rawFilename.toLowerCase();
    if (lowerFilename.endsWith('.svg') || lowerFilename.endsWith('.svgz') || lowerFilename.endsWith('.html') || lowerFilename.endsWith('.htm')) {
      return res.status(400).json({ error: 'File extension not allowed' });
    }

    // Sanitize filename: strip path components and non-safe chars
    const safeBasename = path.basename(rawFilename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(safeBasename) || '.bin';
    // Validate extension doesn't contain path traversal
    if (ext.includes('/') || ext.includes('\\') || ext.includes('..')) {
      return res.status(400).json({ error: 'Invalid file extension' });
    }

    // Generate unique filename
    const hash = crypto.randomBytes(16).toString('hex');
    const storedName = `${hash}${ext}`;
    const filePath = path.join(UPLOAD_DIR, storedName);

    // Final path traversal check: ensure resolved path is within UPLOAD_DIR
    if (!path.resolve(filePath).startsWith(path.resolve(UPLOAD_DIR))) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    fs.writeFileSync(filePath, data);

    // Save to DB
    const result = await db.query(
      `INSERT INTO file_uploads (original_name, stored_name, mime_type, size_bytes, conversation_id, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [safeBasename, storedName, mimeType, data.length, req.query.conversationId || null, req.query.sender || 'visitor']
    );

    const file = result.rows[0];
    const fileUrl = `/uploads/${storedName}`;

    logger.info(`File uploaded: ${safeBasename} (${data.length} bytes) -> ${storedName}`);

    res.json({
      id: file.id,
      url: fileUrl,
      name: safeBasename,
      mimeType,
      size: data.length,
    });
  } catch (e) {
    if (e.message === 'File too large') {
      return res.status(413).json({ error: 'File too large (max 10 MB)' });
    }
    logger.error('Upload error:', e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Simple multipart parser
function parseMultipart(buffer, boundary) {
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = buffer.indexOf(boundaryBuf);

  while (start !== -1) {
    const nextStart = buffer.indexOf(boundaryBuf, start + boundaryBuf.length);
    if (nextStart === -1) break;

    const part = buffer.slice(start + boundaryBuf.length, nextStart);
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) { start = nextStart; continue; }

    const headerStr = part.slice(0, headerEnd).toString('utf-8');
    const data = part.slice(headerEnd + 4, part.length - 2); // strip trailing \r\n

    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    const contentTypeMatch = headerStr.match(/Content-Type:\s*(.+)/i);

    if (filenameMatch) {
      return {
        filename: filenameMatch[1],
        mimeType: contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream',
        data,
      };
    }

    start = nextStart;
  }

  return null;
}

module.exports = router;
