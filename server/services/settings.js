/**
 * Centralized Settings Service
 *
 * Config priority: DB (config table) > .env fallback
 * All settings editable via Dashboard panel or Setup wizard.
 */

const { db } = require('../utils/db');
const { redis } = require('../utils/redis');
const { logger } = require('../utils/logger');

const CACHE_KEY = 'settings:all';
const CACHE_TTL = 120; // 2 min

// ─── Default settings (used if neither DB nor .env has a value) ───
const DEFAULTS = {
  // SMTP
  'smtp.host': '',
  'smtp.port': '587',
  'smtp.user': '',
  'smtp.password': '',
  'smtp.from': 'chatbot@redegal.com',
  'notification.email': '',

  // SIP / RDGPhone (Vozelia Cloud PBX)
  'sip.domain': '',
  'sip.port': '5060',
  'sip.extension': '',
  'sip.password': '',
  'rdgphone.extensions': '',
  'rdgphone.callerid_name': 'Lead Web',

  // AI
  'ai.provider': 'gemini',
  'ai.max_tokens': '2048',
  'ai.temperature': '0.4',

  // Business Hours
  'hours.timezone': 'Europe/Madrid',
  'hours.start': '9',
  'hours.end': '19',
  'hours.days': '1,2,3,4,5',

  // Branding
  'brand.primary_color': '#007fff',
  'brand.company_name': 'Redegal',

  // System
  'setup.completed': 'false',
};

// Map DB keys to env var names for fallback
const ENV_MAP = {
  'smtp.host': 'SMTP_HOST',
  'smtp.port': 'SMTP_PORT',
  'smtp.user': 'SMTP_USER',
  'smtp.password': 'SMTP_PASSWORD',
  'smtp.from': 'SMTP_FROM',
  'notification.email': 'NOTIFICATION_EMAIL',
  'sip.domain': 'SIP_DOMAIN',
  'sip.port': 'SIP_PORT',
  'sip.extension': 'SIP_EXTENSION',
  'sip.password': 'SIP_PASSWORD',
  'rdgphone.extensions': 'CLICK2CALL_EXTENSIONS',
  'rdgphone.callerid_name': 'CLICK2CALL_CALLERID_NAME',
  'ai.provider': 'AI_PROVIDER',
  'hours.timezone': 'TIMEZONE',
  'hours.start': 'BUSINESS_HOURS_START',
  'hours.end': 'BUSINESS_HOURS_END',
  'brand.primary_color': 'PRIMARY_COLOR',
};

// Settings that should never be returned to the client in plain text
const SENSITIVE_KEYS = new Set([
  'smtp.password', 'sip.password',
]);

// ─── Load all settings from DB ───
async function loadAll() {
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}

  try {
    const result = await db.query('SELECT key, value FROM config');
    const settings = {};
    for (const row of result.rows) {
      // value is stored as JSONB — unwrap if it's a simple string
      settings[row.key] = typeof row.value === 'object' && row.value !== null && 'v' in row.value
        ? row.value.v
        : (typeof row.value === 'string' ? row.value : JSON.stringify(row.value));
    }
    try { await redis.set(CACHE_KEY, JSON.stringify(settings), CACHE_TTL); } catch {}
    return settings;
  } catch (e) {
    logger.warn('Settings: Failed to load from DB:', e.message);
    return {};
  }
}

// ─── Get a single setting: DB > env > default ───
async function get(key) {
  const all = await loadAll();
  if (all[key] !== undefined && all[key] !== '') return all[key];
  const envKey = ENV_MAP[key];
  if (envKey && process.env[envKey]) return process.env[envKey];
  return DEFAULTS[key] || '';
}

// ─── Get multiple settings at once ───
async function getMany(keys) {
  const all = await loadAll();
  const result = {};
  for (const key of keys) {
    if (all[key] !== undefined && all[key] !== '') {
      result[key] = all[key];
    } else {
      const envKey = ENV_MAP[key];
      result[key] = (envKey && process.env[envKey]) || DEFAULTS[key] || '';
    }
  }
  return result;
}

// ─── Get all settings (for admin panel) — masks sensitive values ───
async function getAllForAdmin() {
  const all = await loadAll();
  const result = {};
  for (const key of Object.keys(DEFAULTS)) {
    let val = all[key];
    if (val === undefined || val === '') {
      const envKey = ENV_MAP[key];
      val = (envKey && process.env[envKey]) || DEFAULTS[key] || '';
    }
    result[key] = SENSITIVE_KEYS.has(key) && val ? '••••••••' : val;
  }
  return result;
}

// ─── Save a single setting to DB ───
async function set(key, value) {
  try {
    await db.query(
      `INSERT INTO config (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, JSON.stringify({ v: value })]
    );
    // Invalidate cache
    try { await redis.del(CACHE_KEY); } catch {}
    return true;
  } catch (e) {
    logger.error(`Settings: Failed to save ${key}:`, e.message);
    return false;
  }
}

// ─── Save multiple settings at once ───
async function setMany(settings) {
  const keys = Object.keys(settings);
  if (keys.length === 0) return true;
  try {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      for (const [key, value] of Object.entries(settings)) {
        // Skip if masked value (don't overwrite with dots)
        if (SENSITIVE_KEYS.has(key) && value === '••••••••') continue;
        await client.query(
          `INSERT INTO config (key, value, updated_at) VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
          [key, JSON.stringify({ v: value })]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    try { await redis.del(CACHE_KEY); } catch {}
    return true;
  } catch (e) {
    logger.error('Settings: Failed to save multiple:', e.message);
    return false;
  }
}

// ─── Check if initial setup is done ───
async function isSetupComplete() {
  const val = await get('setup.completed');
  return val === 'true';
}

module.exports = { get, getMany, getAllForAdmin, set, setMany, isSetupComplete, DEFAULTS, SENSITIVE_KEYS };
