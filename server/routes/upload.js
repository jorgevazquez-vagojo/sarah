const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
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

const sanitizeFilename = (raw) => {
  const safeBasename = path.basename(raw).replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = path.extname(safeBasename) || '.bin';
  if (ext.includes('/') || ext.includes('\\') || ext.includes('..')) {
    return { ok: false, error: 'Invalid file extension' };
  }
  return { ok: true, safeBasename, ext };
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const { ok, safeBasename, ext, error } = sanitizeFilename(file.originalname || 'upload.bin');
    if (!ok) return cb(new Error(error));
    const hash = crypto.randomBytes(16).toString('hex');
    cb(null, `${hash}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype || 'application/octet-stream';
    if (!ALLOWED_TYPES.has(mime)) return cb(new Error(`File type ${mime} not allowed`));
    const lower = (file.originalname || '').toLowerCase();
    if (lower.endsWith('.svg') || lower.endsWith('.svgz') || lower.endsWith('.html') || lower.endsWith('.htm')) {
      return cb(new Error('File extension not allowed'));
    }
    cb(null, true);
  },
});

// File upload — accepts multipart/form-data with a single "file" field
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Final path traversal check: ensure resolved path is within UPLOAD_DIR
    if (!path.resolve(req.file.path).startsWith(path.resolve(UPLOAD_DIR))) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    const { safeBasename } = sanitizeFilename(req.file.originalname || 'upload.bin');
    if (!safeBasename) return res.status(400).json({ error: 'Invalid filename' });

    // Save to DB
    const result = await db.query(
      `INSERT INTO file_uploads (original_name, stored_name, mime_type, size_bytes, conversation_id, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        safeBasename,
        req.file.filename,
        req.file.mimetype,
        req.file.size,
        req.query.conversationId || null,
        req.query.sender || 'visitor',
      ]
    );

    const file = result.rows[0];
    const fileUrl = `/uploads/${req.file.filename}`;

    logger.info(`File uploaded: ${safeBasename} (${req.file.size} bytes) -> ${req.file.filename}`);

    res.json({
      id: file.id,
      url: fileUrl,
      name: safeBasename,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });
  } catch (e) {
    if (e.message && e.message.includes('File too large')) {
      return res.status(413).json({ error: 'File too large (max 10 MB)' });
    }
    if (e.message && (e.message.includes('not allowed') || e.message.includes('Invalid file'))) {
      return res.status(400).json({ error: e.message });
    }
    logger.error('Upload error:', e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
