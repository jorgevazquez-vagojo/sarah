/**
 * Knowledge Base Auto-Updater — scrapes redegal.com periodically
 * and updates knowledge entries when content changes.
 *
 * Runs every 24h (configurable). Scrapes key pages, extracts content,
 * compares hash to detect changes, and upserts knowledge entries.
 */

const crypto = require('crypto');
const { logger } = require('../utils/logger');
const { db } = require('../utils/db');
const { generateEmbedding } = require('./embeddings');

// Pages to scrape from redegal.com
const SCRAPE_TARGETS = [
  { url: 'https://www.redegal.com/es/', category: 'empresa', businessLine: 'general', title: 'Redegal - Página principal' },
  { url: 'https://www.redegal.com/es/quienes-somos/', category: 'empresa', businessLine: 'general', title: 'Quiénes somos' },
  { url: 'https://www.redegal.com/es/servicios/', category: 'servicios', businessLine: 'general', title: 'Servicios Redegal' },
  { url: 'https://www.redegal.com/es/servicios/boostic/', category: 'producto', businessLine: 'boostic', title: 'Boostic - SEO & Growth' },
  { url: 'https://www.redegal.com/es/servicios/binnacle-data/', category: 'producto', businessLine: 'binnacle', title: 'Binnacle Data - BI' },
  { url: 'https://www.redegal.com/es/servicios/marketing-digital/', category: 'servicios', businessLine: 'marketing', title: 'Marketing Digital' },
  { url: 'https://www.redegal.com/es/servicios/tech/', category: 'servicios', businessLine: 'tech', title: 'Tech - Desarrollo' },
  { url: 'https://www.redegal.com/es/casos-de-exito/', category: 'casos', businessLine: 'general', title: 'Casos de éxito' },
  { url: 'https://www.redegal.com/es/blog/', category: 'blog', businessLine: 'general', title: 'Blog Redegal' },
  { url: 'https://www.redegal.com/es/contacto/', category: 'contacto', businessLine: 'general', title: 'Contacto' },
  { url: 'https://www.redegal.com/es/accionistas-e-inversores/', category: 'inversores', businessLine: 'general', title: 'Accionistas e Inversores' },
];

const SCRAPE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
let scrapeTimer = null;

function contentHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// ─── Fetch and extract text content from a URL ───
async function fetchPageContent(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'RedegalChatbot/1.0 (knowledge-updater)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();

    // Extract meaningful text (strip HTML tags, scripts, styles)
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Take first 5000 chars (enough for knowledge)
    return text.slice(0, 5000);
  } catch (e) {
    logger.warn(`Failed to fetch ${url}: ${e.message}`);
    return null;
  }
}

// ─── Scrape a single target ───
async function scrapeTarget(target) {
  const content = await fetchPageContent(target.url);
  if (!content || content.length < 50) {
    await logScrape(target.url, target.title, null, 0, 0, 'error', 'Content too short or empty');
    return { added: 0, updated: 0 };
  }

  const hash = contentHash(content);

  // Check if content changed since last scrape
  const { rows: lastScrape } = await db.query(
    `SELECT content_hash FROM kb_scrape_log WHERE url = $1 ORDER BY scraped_at DESC LIMIT 1`,
    [target.url]
  );

  if (lastScrape[0]?.content_hash === hash) {
    return { added: 0, updated: 0 }; // No changes
  }

  // Check if knowledge entry already exists for this URL
  const { rows: existing } = await db.query(
    `SELECT id FROM knowledge_entries WHERE metadata->>'source_url' = $1 LIMIT 1`,
    [target.url]
  );

  let added = 0, updated = 0;
  const embedding = await generateEmbedding(content);
  const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;

  if (existing[0]) {
    // Update existing entry
    await db.query(
      `UPDATE knowledge_entries SET content = $2, embedding = $3::vector, metadata = metadata || $4::jsonb
       WHERE id = $1`,
      [existing[0].id, content, embeddingStr, JSON.stringify({ scraped_at: new Date().toISOString(), content_hash: hash })]
    );
    updated = 1;
  } else {
    // Insert new entry
    await db.query(
      `INSERT INTO knowledge_entries (business_line, language, category, title, content, source, embedding, metadata)
       VALUES ($1, 'es', $2, $3, $4, 'scraper', $5::vector, $6)`,
      [target.businessLine, target.category, target.title, content, embeddingStr,
       JSON.stringify({ source_url: target.url, content_hash: hash, scraped_at: new Date().toISOString() })]
    );
    added = 1;
  }

  await logScrape(target.url, target.title, hash, added, updated, 'success', null);
  return { added, updated };
}

async function logScrape(url, title, hash, added, updated, status, error) {
  try {
    await db.query(
      `INSERT INTO kb_scrape_log (url, title, content_hash, entries_added, entries_updated, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [url, title, hash, added, updated, status, error]
    );
  } catch (e) {
    logger.warn('Failed to log scrape:', e.message);
  }
}

// ─── Run full scrape cycle ───
async function runScrape() {
  logger.info('KB Scraper: starting scrape cycle...');
  let totalAdded = 0, totalUpdated = 0, errors = 0;

  for (const target of SCRAPE_TARGETS) {
    try {
      const result = await scrapeTarget(target);
      totalAdded += result.added;
      totalUpdated += result.updated;
    } catch (e) {
      errors++;
      logger.warn(`KB Scraper error for ${target.url}: ${e.message}`);
    }
    // Rate limit: wait 2s between requests
    await new Promise((r) => setTimeout(r, 2000));
  }

  logger.info(`KB Scraper done: ${totalAdded} added, ${totalUpdated} updated, ${errors} errors`);
  return { added: totalAdded, updated: totalUpdated, errors };
}

// ─── Also embed existing YAML-sourced knowledge entries that lack embeddings ───
async function embedExistingKnowledge() {
  try {
    const { rows } = await db.query(
      `SELECT id, title, content FROM knowledge_entries WHERE embedding IS NULL LIMIT 50`
    );
    if (rows.length === 0) return;

    logger.info(`Embedding ${rows.length} existing knowledge entries...`);
    for (const row of rows) {
      const embedding = await generateEmbedding(row.title + ' ' + row.content);
      if (embedding) {
        await db.query(
          `UPDATE knowledge_entries SET embedding = $2::vector WHERE id = $1`,
          [row.id, `[${embedding.join(',')}]`]
        );
      }
      await new Promise((r) => setTimeout(r, 500)); // Rate limit
    }
    logger.info('Finished embedding existing knowledge entries');
  } catch (e) {
    logger.warn('Embed existing KB failed:', e.message);
  }
}

// ─── Get scrape history for dashboard ───
async function getScrapeHistory(limit = 50) {
  const { rows } = await db.query(
    `SELECT * FROM kb_scrape_log ORDER BY scraped_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

// ─── Initialize periodic scraping ───
function initScraper() {
  // Run initial scrape after 30s (let server stabilize)
  setTimeout(async () => {
    try {
      await embedExistingKnowledge();
      await runScrape();
    } catch (e) {
      logger.warn('Initial scrape failed:', e.message);
    }
  }, 30000);

  // Then run every 24h
  scrapeTimer = setInterval(async () => {
    try {
      await runScrape();
    } catch (e) {
      logger.warn('Periodic scrape failed:', e.message);
    }
  }, SCRAPE_INTERVAL_MS);

  logger.info('KB Scraper initialized (interval: 24h)');
}

function stopScraper() {
  if (scrapeTimer) {
    clearInterval(scrapeTimer);
    scrapeTimer = null;
  }
}

module.exports = { initScraper, stopScraper, runScrape, getScrapeHistory, embedExistingKnowledge };
