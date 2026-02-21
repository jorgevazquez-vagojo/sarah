#!/usr/bin/env node
/**
 * Seeds demo agents for the Redegal corporate website chatbot.
 * Creates realistic agent personas: sales, tech consultant, investor relations.
 * Usage: node scripts/seed-demo-agents.js [password]
 */
require('dotenv/config');
const path = require('path');
const bcrypt = require('bcryptjs');

process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';

const DEMO_AGENTS = [
  {
    username: 'sofia.ventas',
    displayName: 'Sofia Martinez',
    role: 'agent',
    email: 'sofia.martinez@redegal.com',
    languages: ['es', 'en', 'pt'],
    businessLines: ['boostic', 'marketing'],
    sipExtension: '107',
  },
  {
    username: 'david.tech',
    displayName: 'David Castineiras',
    role: 'agent',
    email: 'david.castineiras@redegal.com',
    languages: ['es', 'en', 'gl'],
    businessLines: ['tech', 'binnacle'],
    sipExtension: '158',
  },
  {
    username: 'claudia.ir',
    displayName: 'Claudia Perez',
    role: 'supervisor',
    email: 'claudia.perez@redegal.com',
    languages: ['es', 'en'],
    businessLines: ['boostic', 'binnacle', 'marketing', 'tech'],
    sipExtension: '105',
  },
];

async function main() {
  const { db } = require(path.join(__dirname, '..', 'server', 'utils', 'db'));
  await db.connect();

  const password = process.argv[2] || 'demo2025';
  const passwordHash = await bcrypt.hash(password, 12);

  console.log(`Seeding ${DEMO_AGENTS.length} demo agents (password: ${password})...\n`);

  for (const member of DEMO_AGENTS) {
    try {
      const existing = await db.getAgentByUsername(member.username);
      if (existing) {
        console.log(`  SKIP  ${member.username} (already exists: ${existing.id})`);
        continue;
      }

      const agent = await db.createAgent({
        username: member.username,
        passwordHash,
        displayName: member.displayName,
        role: member.role,
        email: member.email,
        languages: member.languages,
        businessLines: member.businessLines,
        sipExtension: member.sipExtension,
      });

      console.log(`  OK  ${agent.display_name} — @${agent.username} (${agent.role}) [${agent.languages.join(',')}] ext:${member.sipExtension}`);
    } catch (e) {
      console.error(`  ERROR ${member.username}: ${e.message}`);
    }
  }

  console.log('\nDone.');
  await db.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
