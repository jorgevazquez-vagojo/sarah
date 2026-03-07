/**
 * Embedding service — generates vector embeddings for RAG.
 * Uses Xenova/multilingual-e5-small (384 dims, local, no API key needed).
 * Same model as Optimus — consistent embeddings across the ecosystem.
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');

const EMBEDDING_DIM = 384;

// ─── HuggingFace pipeline singleton ───
let _pipeline = null;

async function getEmbeddingPipeline() {
  if (_pipeline) return _pipeline;
  const { pipeline, env } = await import('@huggingface/transformers');
  if (process.env.HF_CACHE_DIR) env.cacheDir = process.env.HF_CACHE_DIR;
  _pipeline = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', {
    dtype: 'fp32',
  });
  logger.info('Embedding pipeline loaded: Xenova/multilingual-e5-small (384d)');
  return _pipeline;
}

// ─── In-process cache (SHA256 key, 1h TTL) ───
const _cache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

function _cacheKey(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// ─── Core embedding functions ───

async function generateEmbedding(text) {
  const cleaned = (text || '').trim().slice(0, 8000);
  const key = _cacheKey(cleaned);
  const cached = _cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.embedding;

  const extractor = await getEmbeddingPipeline();
  const output = await extractor(cleaned, { pooling: 'mean', normalize: true });
  const embedding = Array.from(output.data);

  _cache.set(key, { embedding, expires: Date.now() + CACHE_TTL_MS });
  return embedding;
}

async function generateEmbeddings(texts) {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  return Promise.all(texts.map(generateEmbedding));
}

// ─── Cosine similarity (for in-memory fallback) ───
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

module.exports = { generateEmbedding, generateEmbeddings, cosineSimilarity, EMBEDDING_DIM };
