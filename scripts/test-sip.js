#!/usr/bin/env node
/**
 * Tests SIP/Asterisk AMI connection.
 * Usage: node scripts/test-sip.js
 */
require('dotenv/config');

async function main() {
  const { connect, getQueueStatus } = require('../server/services/sip-manager');

  console.log('Connecting to Asterisk AMI...');
  connect();

  // Wait for connection
  await new Promise((r) => setTimeout(r, 3000));

  try {
    const status = await getQueueStatus('queue-general');
    console.log('Queue status:', JSON.stringify(status, null, 2));
  } catch (e) {
    console.error('Queue status error:', e.message);
  }

  console.log('Done. Press Ctrl+C to exit.');
}

main().catch(console.error);
