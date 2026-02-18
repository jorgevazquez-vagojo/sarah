const { Pool } = require('pg');
const { logger } = require('./logger');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'redegal_chatbot',
  user: process.env.POSTGRES_USER || 'redegal',
  password: process.env.POSTGRES_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => logger.error('Unexpected DB pool error', err));

const db = {
  connect: async () => { const c = await pool.connect(); c.release(); },
  query: (t, p) => pool.query(t, p),
  end: () => pool.end(),

  // ─── Conversations ───
  createConversation: async ({ visitorId, language, businessLine }) => {
    const r = await pool.query(
      `INSERT INTO conversations (visitor_id, language, business_line, state)
       VALUES ($1, $2, $3, 'chat_idle') RETURNING *`,
      [visitorId, language || 'es', businessLine]
    );
    return r.rows[0];
  },

  getConversation: async (id) => {
    const r = await pool.query(`SELECT * FROM conversations WHERE id = $1`, [id]);
    return r.rows[0];
  },

  getActiveConversation: async (visitorId) => {
    const r = await pool.query(
      `SELECT * FROM conversations WHERE visitor_id = $1 AND closed_at IS NULL
       ORDER BY started_at DESC LIMIT 1`,
      [visitorId]
    );
    return r.rows[0];
  },

  updateConversation: async (id, fields) => {
    const sets = [];
    const vals = [];
    let i = 1;
    for (const [k, v] of Object.entries(fields)) {
      sets.push(`${k} = $${i}`);
      vals.push(v);
      i++;
    }
    sets.push(`updated_at = NOW()`);
    vals.push(id);
    const r = await pool.query(
      `UPDATE conversations SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    return r.rows[0];
  },

  // ─── Messages ───
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
  saveLead: async ({ conversationId, name, email, phone, company, businessLine, language }) => {
    const r = await pool.query(
      `INSERT INTO leads (conversation_id, name, email, phone, company, business_line, language)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [conversationId, name, email, phone, company, businessLine, language]
    );
    return r.rows[0];
  },

  getLeads: async ({ status, businessLine, limit = 50, offset = 0 } = {}) => {
    const conds = [];
    const vals = [];
    let i = 1;
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

  updateLead: async (id, fields) => {
    const sets = [];
    const vals = [];
    let i = 1;
    for (const [k, v] of Object.entries(fields)) {
      sets.push(`${k} = $${i}`);
      vals.push(v);
      i++;
    }
    sets.push(`updated_at = NOW()`);
    vals.push(id);
    const r = await pool.query(
      `UPDATE leads SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    return r.rows[0];
  },

  // ─── Agents ───
  getAgent: async (id) => {
    const r = await pool.query(`SELECT * FROM agents WHERE id = $1`, [id]);
    return r.rows[0];
  },

  getAgentByUsername: async (username) => {
    const r = await pool.query(`SELECT * FROM agents WHERE username = $1`, [username]);
    return r.rows[0];
  },

  getAvailableAgents: async ({ language, businessLine } = {}) => {
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

  updateAgentStatus: async (id, status) => {
    await pool.query(
      `UPDATE agents SET status = $2, last_seen_at = NOW() WHERE id = $1`,
      [id, status]
    );
  },

  createAgent: async ({ username, passwordHash, displayName, languages, businessLines, sipExtension }) => {
    const r = await pool.query(
      `INSERT INTO agents (username, password_hash, display_name, languages, business_lines, sip_extension)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [username, passwordHash, displayName, languages || ['es'], businessLines || [], sipExtension]
    );
    return r.rows[0];
  },

  // ─── Knowledge ───
  searchKnowledge: async (query, businessLine, language, limit = 5) => {
    const r = await pool.query(
      `SELECT id, business_line, category, title, content, tags
       FROM knowledge_entries
       WHERE ($2::text IS NULL OR business_line = $2)
         AND ($3::text IS NULL OR language = $3)
         AND to_tsvector('spanish', title || ' ' || content) @@ plainto_tsquery('spanish', $1)
       ORDER BY ts_rank(to_tsvector('spanish', title || ' ' || content), plainto_tsquery('spanish', $1)) DESC
       LIMIT $4`,
      [query, businessLine || null, language || null, limit]
    );
    return r.rows;
  },

  insertKnowledge: async ({ businessLine, language, category, title, content, tags }) => {
    const r = await pool.query(
      `INSERT INTO knowledge_entries (business_line, language, category, title, content, tags)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [businessLine, language || 'es', category, title, content, tags || []]
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
    const sets = [];
    const vals = [];
    let i = 1;
    for (const [k, v] of Object.entries(fields)) {
      sets.push(`${k} = $${i}`);
      vals.push(v);
      i++;
    }
    vals.push(id);
    await pool.query(`UPDATE calls SET ${sets.join(', ')} WHERE id = $${i}`, vals);
  },

  // ─── Analytics ───
  trackEvent: async ({ eventType, conversationId, visitorId, agentId, businessLine, language, data }) => {
    await pool.query(
      `INSERT INTO analytics_events (event_type, conversation_id, visitor_id, agent_id, business_line, language, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [eventType, conversationId, visitorId, agentId, businessLine, language, data || {}]
    );
  },

  // ─── Config ───
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
  getWaitingConversations: async () => {
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
