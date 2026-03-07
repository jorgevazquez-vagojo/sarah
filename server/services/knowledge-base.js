const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { logger } = require('../utils/logger');
const { db } = require('../utils/db');

const KB_DIR = path.join(__dirname, '..', 'config', 'knowledge');
const knowledgeCache = {};

function loadKnowledgeFiles() {
  const files = fs.readdirSync(KB_DIR).filter((f) => f.endsWith('.yaml'));
  for (const file of files) {
    const line = path.basename(file, '.yaml');
    const data = yaml.load(fs.readFileSync(path.join(KB_DIR, file), 'utf8'));
    knowledgeCache[line] = data.entries || [];
    logger.info(`Loaded knowledge: ${line} (${knowledgeCache[line].length} entries)`);
  }
}

async function seedKnowledgeToDB() {
  for (const [line, entries] of Object.entries(knowledgeCache)) {
    for (const entry of entries) {
      try {
        await db.insertKnowledge({
          businessLine: line,
          language: 'es',
          category: entry.category,
          title: entry.title,
          content: entry.content.trim(),
          tags: entry.tags || [],
        });
      } catch (e) {
        if (!e.message.includes('duplicate')) {
          logger.warn(`Failed to seed knowledge entry: ${entry.title}`, e.message);
        }
      }
    }
  }
  logger.info('Knowledge base seeded to DB');
}

function getContextForLine(businessLine) {
  const general = knowledgeCache['general'] || [];
  const specific = knowledgeCache[businessLine] || [];
  return [...general, ...specific]
    .map((e) => `## ${e.title}\n${e.content.trim()}`)
    .join('\n\n');
}

async function searchKnowledge(query, businessLine, language) {
  const results = await db.searchKnowledge(query, businessLine, language);
  if (results.length > 0) return results;
  // Fallback to in-memory YAML
  const entries = [...(knowledgeCache['general'] || []), ...(knowledgeCache[businessLine] || [])];
  const q = query.toLowerCase();
  return entries
    .filter((e) => e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q))
    .slice(0, 5);
}

// ─── RAG Service central search ───
// When RAG_SERVICE_URL is configured, delegates vector search to the central rag-service.
// Audience defaults to ["lead","*"] (public web visitor). Pass "commercial" for agents.
async function ragServiceSearch(query, businessLine, language, audience = 'lead', limit = 3) {
  const ragUrl = process.env.RAG_SERVICE_URL;
  const ragKey = process.env.RAG_SERVICE_KEY;
  if (!ragUrl) return null; // not configured

  const body = {
    query,
    scope: {
      audience: [audience, '*'],
      businessLine: businessLine ? [businessLine, '*'] : ['*'],
      language: language || null,
    },
    limit,
    threshold: 0.5,
  };

  const res = await fetch(`${ragUrl}/v1/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Rag-Key': ragKey || '',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`rag-service responded ${res.status}`);
  }

  const { results } = await res.json();
  return (results || []).map((r) => ({
    title: r.documentTitle || r.source || 'Knowledge',
    content: r.content,
    business_line: businessLine,
    similarity: r.similarity,
  }));
}

// ─── Vector search (RAG) using pgvector embeddings ───
// If RAG_SERVICE_URL is configured, uses central rag-service (with fallback to local pgvector).
async function vectorSearchKnowledge(query, businessLine, limit = 3, language = null, audience = 'lead') {
  // Try central rag-service first
  if (process.env.RAG_SERVICE_URL) {
    try {
      const results = await ragServiceSearch(query, businessLine, language, audience, limit);
      if (results && results.length > 0) return results;
    } catch (e) {
      logger.debug('rag-service search failed, falling back to local pgvector: %s', e.message);
    }
  }

  // Local pgvector fallback
  const { generateEmbedding } = require('./embeddings');
  const embedding = await generateEmbedding(query);
  if (!embedding) return [];

  const embeddingStr = `[${embedding.join(',')}]`;
  const { rows } = await db.query(
    `SELECT title, content, business_line,
            1 - (embedding <=> $1::vector) AS similarity
     FROM knowledge_entries
     WHERE embedding IS NOT NULL
       AND ($2::text IS NULL OR business_line = $2)
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [embeddingStr, businessLine || null, limit]
  );
  return rows.filter((r) => r.similarity > 0.5);
}

module.exports = { loadKnowledgeFiles, seedKnowledgeToDB, getContextForLine, searchKnowledge, vectorSearchKnowledge };
