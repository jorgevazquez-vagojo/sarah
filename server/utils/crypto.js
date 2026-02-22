/**
 * AES-256-GCM encryption/decryption for sensitive data at rest.
 * Used primarily for CRM credentials stored in the database.
 *
 * Key derivation: uses ENCRYPTION_KEY env var, or falls back to
 * a PBKDF2 derivation from JWT_SECRET (so existing deployments
 * gain encryption without adding a new env var).
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;      // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;     // 128-bit auth tag
const ENCODING = 'base64';

/**
 * Derive or load the 256-bit encryption key.
 * Priority: ENCRYPTION_KEY env > PBKDF2(JWT_SECRET)
 */
function getKey() {
  if (process.env.ENCRYPTION_KEY) {
    // Expect a 64-char hex string (32 bytes)
    const buf = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    if (buf.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    }
    return buf;
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('Neither ENCRYPTION_KEY nor JWT_SECRET is set — cannot encrypt');
  }

  // Deterministic derivation so the same JWT_SECRET always yields the same key
  return crypto.pbkdf2Sync(jwtSecret, 'sarah-crm-encryption-salt', 100000, 32, 'sha256');
}

/**
 * Encrypt plaintext string.
 * Returns base64 string: iv + authTag + ciphertext
 */
function encrypt(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return plaintext;

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();

  // Pack: iv (12) + tag (16) + ciphertext (variable)
  const packed = Buffer.concat([iv, tag, encrypted]);
  return packed.toString(ENCODING);
}

/**
 * Decrypt a base64-encoded ciphertext produced by encrypt().
 * Returns the original plaintext string.
 */
function decrypt(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string') return ciphertext;

  const key = getKey();
  const packed = Buffer.from(ciphertext, ENCODING);

  if (packed.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('Ciphertext too short — not a valid encrypted value');
  }

  const iv = packed.subarray(0, IV_LENGTH);
  const tag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = packed.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Encrypt all string values in an object (shallow).
 * Useful for encrypting a CRM config object with multiple credential fields.
 */
function encryptObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = typeof v === 'string' ? encrypt(v) : v;
  }
  return result;
}

/**
 * Decrypt all string values in an object (shallow).
 */
function decryptObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    try {
      result[k] = typeof v === 'string' ? decrypt(v) : v;
    } catch {
      // If decryption fails, the value was probably stored in plaintext (pre-migration)
      result[k] = v;
    }
  }
  return result;
}

module.exports = { encrypt, decrypt, encryptObject, decryptObject };
