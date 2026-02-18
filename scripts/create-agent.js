#!/usr/bin/env node
/**
 * Creates an agent user.
 * Usage: node scripts/create-agent.js <username> <password> <displayName> [role] [languages] [businessLines] [email]
 * Example: node scripts/create-agent.js admin admin123 "Admin User" admin "es,gl,en" "boostic,tech" "admin@redegal.com"
 * Roles: agent, supervisor, admin, architect, developer, qa
 */
require('dotenv/config');
const path = require('path');
const bcrypt = require('bcryptjs');

process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';

async function main() {
  const [,, username, password, displayName, role, langs, lines, email] = process.argv;

  if (!username || !password || !displayName) {
    console.error('Usage: node create-agent.js <username> <password> <displayName> [role] [languages] [businessLines] [email]');
    console.error('Roles: agent, supervisor, admin, architect, developer, qa');
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
    role: role || 'agent',
    languages,
    businessLines,
    email: email || null,
  });

  console.log(`Agent created: ${agent.username} (${agent.id}) role=${agent.role}`);
  await db.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
