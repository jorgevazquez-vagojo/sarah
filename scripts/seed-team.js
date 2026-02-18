#!/usr/bin/env node
/**
 * Seeds the team: 1 architect, 3 developers, 1 QA.
 * All passwords default to "redegal2024" — change in production.
 * Usage: node scripts/seed-team.js
 */
require('dotenv/config');
const path = require('path');
const bcrypt = require('bcryptjs');

process.env.POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';

const TEAM = [
  {
    username: 'carlos.arq',
    displayName: 'Carlos Fernandez',
    role: 'architect',
    email: 'carlos.fernandez@redegal.com',
    languages: ['es', 'en', 'gl'],
    businessLines: ['boostic', 'binnacle', 'marketing', 'tech'],
  },
  {
    username: 'ana.dev',
    displayName: 'Ana Garcia',
    role: 'developer',
    email: 'ana.garcia@redegal.com',
    languages: ['es', 'en'],
    businessLines: ['boostic', 'marketing'],
  },
  {
    username: 'pablo.dev',
    displayName: 'Pablo Rodriguez',
    role: 'developer',
    email: 'pablo.rodriguez@redegal.com',
    languages: ['es', 'gl'],
    businessLines: ['binnacle', 'tech'],
  },
  {
    username: 'laura.dev',
    displayName: 'Laura Martinez',
    role: 'developer',
    email: 'laura.martinez@redegal.com',
    languages: ['es', 'en', 'pt'],
    businessLines: ['boostic', 'binnacle', 'marketing', 'tech'],
  },
  {
    username: 'marta.qa',
    displayName: 'Marta Lopez',
    role: 'qa',
    email: 'marta.lopez@redegal.com',
    languages: ['es', 'en', 'gl'],
    businessLines: ['boostic', 'binnacle', 'marketing', 'tech'],
  },
];

async function main() {
  const { db } = require(path.join(__dirname, '..', 'server', 'utils', 'db'));
  await db.connect();

  const password = process.argv[2] || 'redegal2024';
  const passwordHash = await bcrypt.hash(password, 12);

  console.log(`Seeding ${TEAM.length} team members (password: ${password})...\n`);

  for (const member of TEAM) {
    try {
      // Check if already exists
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
      });

      const roleIcon = { architect: '\u{1F3D7}', developer: '\u{1F4BB}', qa: '\u{1F50D}' }[member.role] || '\u{1F464}';
      console.log(`  ${roleIcon}  ${agent.display_name} — @${agent.username} (${agent.role}) [${agent.languages.join(',')}]`);
    } catch (e) {
      console.error(`  ERROR ${member.username}: ${e.message}`);
    }
  }

  console.log('\nDone.');
  await db.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
