/**
 * Embedding service — generates vector embeddings for RAG.
 * Primary: Gemini text-embedding-004 (free, 768 dims)
 * Fallback: OpenAI text-embedding-3-small (1536 dims, truncated to 768)
 */

const { logger } = require('../utils/logger');

const EMBEDDING_DIM = 768;

// ─── Gemini Embeddings (free tier) ───
async function geminiEmbed(texts) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

  const results = [];
  for (const text of texts) {
    const result = await model.embedContent(text);
    results.push(result.embedding.values);
  }
  return results;
}

// ─── OpenAI Embeddings (fallback) ───
async function openaiEmbed(texts) {
  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
    dimensions: EMBEDDING_DIM,
  });
  return response.data.map((d) => d.embedding);
}

// ─── Router with fallback ───
async function generateEmbeddings(texts) {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  // Clean texts
  const cleaned = texts.map((t) => (t || '').trim().slice(0, 8000));

  try {
    if (process.env.GEMINI_API_KEY) {
      return await geminiEmbed(cleaned);
    }
  } catch (e) {
    logger.warn('Gemini embedding failed, trying OpenAI:', e.message);
  }

  try {
    if (process.env.OPENAI_API_KEY) {
      return await openaiEmbed(cleaned);
    }
  } catch (e) {
    logger.warn('OpenAI embedding failed:', e.message);
  }

  logger.error('All embedding providers failed');
  return [];
}

async function generateEmbedding(text) {
  const results = await generateEmbeddings([text]);
  return results[0] || null;
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
