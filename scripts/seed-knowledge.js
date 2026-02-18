#!/usr/bin/env node
/**
 * Seeds knowledge base from YAML files to PostgreSQL.
 * Usage: node scripts/seed-knowledge.js
 */
require('dotenv/config');
const path = require('path');

// Point to server modules
process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';

async function main() {
  const { db } = require(path.join(__dirname, '..', 'server', 'utils', 'db'));
  const { loadKnowledgeFiles, seedKnowledgeToDB } = require(path.join(__dirname, '..', 'server', 'services', 'knowledge-base'));

  await db.connect();
  console.log('Connected to PostgreSQL');

  loadKnowledgeFiles();
  await seedKnowledgeToDB();

  console.log('Knowledge base seeded successfully');
  await db.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
