#!/usr/bin/env node
/**
 * Creates an agent user.
 * Usage: node scripts/create-agent.js <username> <password> <displayName> [languages] [businessLines]
 * Example: node scripts/create-agent.js admin admin123 "Admin User" "es,gl,en" "boostic,tech"
 */
require('dotenv/config');
const path = require('path');
const bcrypt = require('bcryptjs');

process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';

async function main() {
  const [,, username, password, displayName, langs, lines] = process.argv;

  if (!username || !password || !displayName) {
    console.error('Usage: node create-agent.js <username> <password> <displayName> [languages] [businessLines]');
    process.exit(1);
  }

  const { db } = require(path.join(__dirname, '..', 'server', 'utils', 'db'));
  await db.connect();

  const passwordHash = await bcrypt.hash(password, 12);
  const languages = langs ? langs.split(',') : ['es'];
  const businessLines = lines ? lines.split(',') : [];

  const agent = await db.createAgent({
    username,
    passwordHash,
    displayName,
    languages,
    businessLines,
  });

  console.log(`Agent created: ${agent.username} (${agent.id})`);
  await db.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
