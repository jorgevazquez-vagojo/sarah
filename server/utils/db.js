/**
 * Database access layer with multi-tenant isolation.
 *
 * Every query that touches tenant-scoped data now accepts an optional
 * `tenantId` parameter. When provided, a `tenant_id = $N` condition is
 * injected into the query so data from different tenants is never mixed.
 *
 * Tables that are tenant-scoped (have a tenant_id column):
 *   conversations, leads, agents, knowledge_entries, canned_responses,
 *   webhooks, analytics_events, calls (via conversation).
 *
 * Tables that are global / not tenant-scoped:
 *   config, messages (scoped via conversation FK).
 */
const { Pool } = require('pg');
const { logger } = require('./logger');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'rdgbot',
  user: process.env.POSTGRES_USER || 'redegal',
  password: process.env.POSTGRES_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => logger.error('Unexpected DB pool error', err));

// Allowlists for dynamic column updates (prevent SQL injection)
const ALLOWED_FIELDS = {
  conversations: new Set([
    'language', 'business_line', 'state', 'agent_id', 'closed_at', 'updated_at', 'metadata',
  ]),
  leads: new Set([
    'name', 'email', 'phone', 'company', 'business_line', 'language', 'status',
    'quality_score', 'notes', 'metadata', 'updated_at',
  ]),
  calls: new Set([
    'status', 'ended_at', 'duration', 'recording_url', 'metadata',
  ]),
};

function buildSafeUpdate(table, id, fields, tenantId) {
  const allowed = ALLOWED_FIELDS[table];
  if (!allowed) throw new Error(`No allowlist for table: ${table}`);
  const sets = [];
  const vals = [];
  let i = 1;
  for (const [k, v] of Object.entries(fields)) {
    if (!allowed.has(k)) {
      logger.warn(`Blocked disallowed column update: ${table}.${k}`);
      continue;
    }
    sets.push(`"${k}" = $${i}`);
    vals.push(v);
    i++;
  }
  if (sets.length === 0) return null;
  sets.push(`updated_at = NOW()`);
  vals.push(id);
  let where = `WHERE id = $${i}`;
  if (tenantId) {
    i++;
    vals.push(tenantId);
    where += ` AND tenant_id = $${i}`;
  }
  return { sql: `SET ${sets.join(', ')} ${where}`, vals };
}

const db = {
  connect: async () => { const c = await pool.connect(); c.release(); },
  query: (t, p) => pool.query(t, p),
  end: () => pool.end(),

  // ─── Conversations ───
  createConversation: async ({ visitorId, language, businessLine, tenantId }) => {
    const r = await pool.query(
      `INSERT INTO conversations (visitor_id, language, business_line, state, tenant_id)
       VALUES ($1, $2, $3, 'chat_idle', $4) RETURNING *`,
      [visitorId, language || 'es', businessLine, tenantId || null]
    );
    return r.rows[0];
  },

  getConversation: async (id, tenantId) => {
    if (tenantId) {
      const r = await pool.query(`SELECT * FROM conversations WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
      return r.rows[0];
    }
    const r = await pool.query(`SELECT * FROM conversations WHERE id = $1`, [id]);
    return r.rows[0];
  },

  getActiveConversation: async (visitorId, tenantId) => {
    if (tenantId) {
      const r = await pool.query(
        `SELECT * FROM conversations WHERE visitor_id = $1 AND closed_at IS NULL AND tenant_id = $2
         ORDER BY started_at DESC LIMIT 1`,
        [visitorId, tenantId]
      );
      return r.rows[0];
    }
    const r = await pool.query(
      `SELECT * FROM conversations WHERE visitor_id = $1 AND closed_at IS NULL
       ORDER BY started_at DESC LIMIT 1`,
      [visitorId]
    );
    return r.rows[0];
  },

  updateConversation: async (id, fields, tenantId) => {
    const update = buildSafeUpdate('conversations', id, fields, tenantId);
    if (!update) return db.getConversation(id, tenantId);
    const r = await pool.query(`UPDATE conversations ${update.sql} RETURNING *`, update.vals);
    return r.rows[0];
  },

  // ─── Messages (scoped via conversation FK, not directly by tenant) ───
  saveMessage: async ({ conversationId, sender, content, metadata }) => {
    const r = await pool.query(
      `INSERT INTO messages (conversation_id, sender, content, metadata)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [conversationId, sender, content, metadata || {}]
    );
    return r.rows[0];
  },

  getMessages: async (conversationId, limit = 50) => {
    const r = await pool.query(
      `SELECT * FROM messages WHERE conversation_id = $1
       ORDER BY created_at ASC LIMIT $2`,
      [conversationId, limit]
    );
    return r.rows;
  },

  // ─── Leads ───
  saveLead: async ({ conversationId, name, email, phone, company, businessLine, language, tenantId }) => {
    const r = await pool.query(
      `INSERT INTO leads (conversation_id, name, email, phone, company, business_line, language, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [conversationId, name, email, phone, company, businessLine, language, tenantId || null]
    );
    return r.rows[0];
  },

  getLeads: async ({ status, businessLine, limit = 50, offset = 0, tenantId } = {}) => {
    const conds = [];
    const vals = [];
    let i = 1;
    if (tenantId) { conds.push(`tenant_id = $${i++}`); vals.push(tenantId); }
    if (status) { conds.push(`status = $${i++}`); vals.push(status); }
    if (businessLine) { conds.push(`business_line = $${i++}`); vals.push(businessLine); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    vals.push(limit, offset);
    const r = await pool.query(
      `SELECT * FROM leads ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i}`,
      vals
    );
    return r.rows;
  },

  updateLead: async (id, fields, tenantId) => {
    const update = buildSafeUpdate('leads', id, fields, tenantId);
    if (!update) return null;
    const r = await pool.query(`UPDATE leads ${update.sql} RETURNING *`, update.vals);
    return r.rows[0];
  },

  // ─── Agents ───
  getAgent: async (id, tenantId) => {
    if (tenantId) {
      const r = await pool.query(`SELECT * FROM agents WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
      return r.rows[0];
    }
    const r = await pool.query(`SELECT * FROM agents WHERE id = $1`, [id]);
    return r.rows[0];
  },

  getAgentByUsername: async (username, tenantId) => {
    if (tenantId) {
      const r = await pool.query(`SELECT * FROM agents WHERE username = $1 AND tenant_id = $2`, [username, tenantId]);
      return r.rows[0];
    }
    const r = await pool.query(`SELECT * FROM agents WHERE username = $1`, [username]);
    return r.rows[0];
  },

  getAvailableAgents: async ({ language, businessLine, tenantId } = {}) => {
    if (tenantId) {
      const r = await pool.query(
        `SELECT * FROM agents
         WHERE status = 'online'
           AND tenant_id = $3
           AND ($1::text IS NULL OR $1 = ANY(languages))
           AND ($2::text IS NULL OR $2 = ANY(business_lines))
         ORDER BY last_seen_at DESC`,
        [language || null, businessLine || null, tenantId]
      );
      return r.rows;
    }
    const r = await pool.query(
      `SELECT * FROM agents
       WHERE status = 'online'
         AND ($1::text IS NULL OR $1 = ANY(languages))
         AND ($2::text IS NULL OR $2 = ANY(business_lines))
       ORDER BY last_seen_at DESC`,
      [language || null, businessLine || null]
    );
    return r.rows;
  },

  updateAgentStatus: async (id, status, tenantId) => {
    if (tenantId) {
      await pool.query(
        `UPDATE agents SET status = $2, last_seen_at = NOW() WHERE id = $1 AND tenant_id = $3`,
        [id, status, tenantId]
      );
      return;
    }
    await pool.query(
      `UPDATE agents SET status = $2, last_seen_at = NOW() WHERE id = $1`,
      [id, status]
    );
  },

  createAgent: async ({ username, passwordHash, displayName, languages, businessLines, sipExtension, role, email, tenantId }) => {
    const r = await pool.query(
      `INSERT INTO agents (username, password_hash, display_name, languages, business_lines, sip_extension, role, email, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [username, passwordHash, displayName, languages || ['es'], businessLines || [], sipExtension, role || 'agent', email, tenantId || null]
    );
    return r.rows[0];
  },

  // ─── Knowledge ───
  searchKnowledge: async (query, businessLine, language, limit = 5, tenantId) => {
    // Map language codes to PostgreSQL text search configurations
    const TS_CONFIGS = { es: 'spanish', en: 'english', pt: 'portuguese' };
    const tsConfig = TS_CONFIGS[language] || 'simple';
    if (tenantId) {
      const r = await pool.query(
        `SELECT id, business_line, category, title, content, tags
         FROM knowledge_entries
         WHERE tenant_id = $6
           AND ($2::text IS NULL OR business_line = $2)
           AND ($3::text IS NULL OR language = $3)
           AND to_tsvector($5::regconfig, title || ' ' || content) @@ plainto_tsquery($5::regconfig, $1)
         ORDER BY ts_rank(to_tsvector($5::regconfig, title || ' ' || content), plainto_tsquery($5::regconfig, $1)) DESC
         LIMIT $4`,
        [query, businessLine || null, language || null, limit, tsConfig, tenantId]
      );
      return r.rows;
    }
    const r = await pool.query(
      `SELECT id, business_line, category, title, content, tags
       FROM knowledge_entries
       WHERE ($2::text IS NULL OR business_line = $2)
         AND ($3::text IS NULL OR language = $3)
         AND to_tsvector($5::regconfig, title || ' ' || content) @@ plainto_tsquery($5::regconfig, $1)
       ORDER BY ts_rank(to_tsvector($5::regconfig, title || ' ' || content), plainto_tsquery($5::regconfig, $1)) DESC
       LIMIT $4`,
      [query, businessLine || null, language || null, limit, tsConfig]
    );
    return r.rows;
  },

  insertKnowledge: async ({ businessLine, language, category, title, content, tags, tenantId }) => {
    const r = await pool.query(
      `INSERT INTO knowledge_entries (business_line, language, category, title, content, tags, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [businessLine, language || 'es', category, title, content, tags || [], tenantId || null]
    );
    return r.rows[0].id;
  },

  // ─── Calls ───
  createCall: async ({ conversationId, agentId, queue, visitorSipId }) => {
    const r = await pool.query(
      `INSERT INTO calls (conversation_id, agent_id, queue, visitor_sip_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [conversationId, agentId, queue, visitorSipId]
    );
    return r.rows[0];
  },

  updateCall: async (id, fields) => {
    const update = buildSafeUpdate('calls', id, fields);
    if (!update) return;
    await pool.query(`UPDATE calls ${update.sql}`, update.vals);
  },

  // ─── Analytics ───
  trackEvent: async ({ eventType, conversationId, visitorId, agentId, businessLine, language, data, tenantId }) => {
    await pool.query(
      `INSERT INTO analytics_events (event_type, conversation_id, visitor_id, agent_id, business_line, language, data, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [eventType, conversationId, visitorId, agentId, businessLine, language, data || {}, tenantId || null]
    );
  },

  // ─── Config (global, not tenant-scoped) ───
  getConfig: async (key) => {
    const r = await pool.query(`SELECT value FROM config WHERE key = $1`, [key]);
    return r.rows[0]?.value;
  },

  setConfig: async (key, value) => {
    await pool.query(
      `INSERT INTO config (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value]
    );
  },

  // ─── Queue: conversations waiting for agent ───
  getWaitingConversations: async (tenantId) => {
    if (tenantId) {
      const r = await pool.query(
        `SELECT c.*, m.content AS last_message
         FROM conversations c
         LEFT JOIN LATERAL (
           SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
         ) m ON true
         WHERE c.state = 'chat_waiting_agent' AND c.closed_at IS NULL AND c.tenant_id = $1
         ORDER BY c.updated_at ASC`,
        [tenantId]
      );
      return r.rows;
    }
    const r = await pool.query(
      `SELECT c.*, m.content AS last_message
       FROM conversations c
       LEFT JOIN LATERAL (
         SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
       ) m ON true
       WHERE c.state = 'chat_waiting_agent' AND c.closed_at IS NULL
       ORDER BY c.updated_at ASC`
    );
    return r.rows;
  },
};

module.exports = { db };
