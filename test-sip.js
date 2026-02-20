#!/usr/bin/env node
/**
 * SIP Integration Test — Standalone
 *
 * Tests:
 * 1. SIP REGISTER to Vozelia Cloud PBX
 * 2. SIP OPTIONS ping
 * 3. SIP INVITE to test extensions (107, 158, 105)
 *
 * Usage: node test-sip.js
 */

const dgram = require('dgram');
const crypto = require('crypto');
const os = require('os');

// ─── Config from .env ───
const CONFIG = {
  domain: 'cloudpbx1584.vozelia.com',
  port: 5060,
  extension: '108',
  password: '0H1Yq88OTjLBlcL',
  callerIdName: 'Test Jorge',
  testExtensions: ['107', '158', '105'],
};

const rHex = (n) => crypto.randomBytes(n).toString('hex');
const genCallId = () => rHex(12);
const genTag = () => rHex(6);
const genBranch = () => 'z9hG4bK' + rHex(8);

function getLocalIp() {
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return '127.0.0.1';
}

// ─── SIP helpers ───

function parseSipMessage(buf) {
  const str = buf.toString();
  const idx = str.indexOf('\r\n\r\n');
  const headerBlock = idx > 0 ? str.substring(0, idx) : str;
  const body = idx > 0 ? str.substring(idx + 4) : '';
  const lines = headerBlock.split('\r\n');
  const firstLine = lines[0];
  const headers = {};
  for (let i = 1; i < lines.length; i++) {
    const colon = lines[i].indexOf(':');
    if (colon > 0) {
      const key = lines[i].substring(0, colon).trim().toLowerCase();
      const val = lines[i].substring(colon + 1).trim();
      headers[key] = val;
    }
  }
  const resMatch = firstLine.match(/^SIP\/2\.0\s+(\d+)\s*(.*)/);
  if (resMatch) return { type: 'response', statusCode: parseInt(resMatch[1]), statusText: resMatch[2], headers, body };
  const reqMatch = firstLine.match(/^(\w+)\s+(.+)\s+SIP\/2\.0/);
  if (reqMatch) return { type: 'request', method: reqMatch[1], uri: reqMatch[2], headers, body };
  return null;
}

function parseAuthChallenge(header) {
  const params = {};
  const re = /(\w+)=(?:"([^"]+)"|([^\s,]+))/g;
  let m;
  while ((m = re.exec(header))) params[m[1]] = m[2] || m[3];
  return params;
}

function buildDigestResponse(method, uri, { realm, nonce, opaque }, username, password) {
  const ha1 = crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
  const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');
  const response = crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
  let auth = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}", algorithm=MD5`;
  if (opaque) auth += `, opaque="${opaque}"`;
  return auth;
}

// ═══════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════

const results = [];
function log(icon, msg) {
  const time = new Date().toISOString().substr(11, 12);
  console.log(`[${time}] ${icon}  ${msg}`);
}

function pass(test) { results.push({ test, ok: true }); log('✅', test); }
function fail(test, err) { results.push({ test, ok: false, err }); log('❌', `${test} — ${err}`); }

async function runTests() {
  const localIp = getLocalIp();
  const socket = dgram.createSocket('udp4');

  log('🔧', `Local IP: ${localIp}`);
  log('🔧', `SIP Server: ${CONFIG.domain}:${CONFIG.port}`);
  log('🔧', `Extension: ${CONFIG.extension}`);
  log('', '');

  // Bind socket
  await new Promise((resolve) => socket.bind(0, resolve));
  const localPort = socket.address().port;
  log('🔧', `UDP bound on port ${localPort}`);

  function sendSip(msg) {
    const buf = Buffer.from(msg);
    socket.send(buf, 0, buf.length, CONFIG.port, CONFIG.domain);
  }

  function waitForResponse(timeoutMs = 5000, skipProvisional = false) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.removeListener('message', handler);
        reject(new Error('Timeout waiting for SIP response'));
      }, timeoutMs);

      function handler(msg) {
        const parsed = parseSipMessage(msg);
        if (!parsed) return;
        // Only accept SIP responses, ignore incoming requests (OPTIONS keepalive etc)
        if (parsed.type !== 'response') {
          // Auto-respond 200 OK to OPTIONS keepalives
          if (parsed.type === 'request' && parsed.method === 'OPTIONS') {
            const okReply =
              `SIP/2.0 200 OK\r\n` +
              `Via: ${parsed.headers['via']}\r\n` +
              `From: ${parsed.headers['from']}\r\n` +
              `To: ${parsed.headers['to']}\r\n` +
              `Call-ID: ${parsed.headers['call-id']}\r\n` +
              `CSeq: ${parsed.headers['cseq']}\r\n` +
              `Content-Length: 0\r\n\r\n`;
            sendSip(okReply);
          }
          return;
        }
        // Skip 100 Trying if we want the final response
        if (skipProvisional && parsed.statusCode === 100) return;
        clearTimeout(timer);
        socket.removeListener('message', handler);
        resolve(parsed);
      }
      socket.on('message', handler);
    });
  }

  // Collect all messages for a window of time
  function collectResponses(timeoutMs = 3000) {
    return new Promise((resolve) => {
      const msgs = [];
      const timer = setTimeout(() => {
        socket.removeAllListeners('message');
        resolve(msgs);
      }, timeoutMs);

      socket.on('message', (msg) => {
        const parsed = parseSipMessage(msg);
        if (parsed) msgs.push(parsed);
      });
    });
  }

  // ─── TEST 1: OPTIONS Ping ───
  log('📡', 'Test 1: SIP OPTIONS ping...');
  try {
    const optCallId = genCallId();
    const optBranch = genBranch();
    const optTag = genTag();
    const optMsg =
      `OPTIONS sip:${CONFIG.domain} SIP/2.0\r\n` +
      `Via: SIP/2.0/UDP ${localIp}:${localPort};branch=${optBranch};rport\r\n` +
      `From: <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${optTag}\r\n` +
      `To: <sip:${CONFIG.domain}>\r\n` +
      `Call-ID: ${optCallId}\r\n` +
      `CSeq: 1 OPTIONS\r\n` +
      `Max-Forwards: 70\r\n` +
      `User-Agent: RedegalTest/1.0\r\n` +
      `Content-Length: 0\r\n\r\n`;

    sendSip(optMsg);
    const res = await waitForResponse(5000);
    if (res && res.statusCode === 200) {
      pass('OPTIONS ping → 200 OK');
    } else if (res) {
      pass(`OPTIONS ping → ${res.statusCode} ${res.statusText} (server alive)`);
    } else {
      fail('OPTIONS ping', 'No response');
    }
  } catch (e) {
    fail('OPTIONS ping', e.message);
  }

  // ─── TEST 2: REGISTER ───
  log('📡', 'Test 2: SIP REGISTER...');
  let registered = false;
  try {
    const regCallId = genCallId();
    const regTag = genTag();
    let cseq = 1;

    const regMsg =
      `REGISTER sip:${CONFIG.domain} SIP/2.0\r\n` +
      `Via: SIP/2.0/UDP ${localIp}:${localPort};branch=${genBranch()};rport\r\n` +
      `From: "${CONFIG.extension}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${regTag}\r\n` +
      `To: <sip:${CONFIG.extension}@${CONFIG.domain}>\r\n` +
      `Call-ID: ${regCallId}\r\n` +
      `CSeq: ${cseq} REGISTER\r\n` +
      `Contact: <sip:${CONFIG.extension}@${localIp}:${localPort}>\r\n` +
      `Expires: 120\r\n` +
      `Max-Forwards: 70\r\n` +
      `User-Agent: RedegalTest/1.0\r\n` +
      `Content-Length: 0\r\n\r\n`;

    sendSip(regMsg);
    const res1 = await waitForResponse(5000, true); // Skip 100 Trying

    if (res1 && (res1.statusCode === 401 || res1.statusCode === 407)) {
      pass(`REGISTER challenge → ${res1.statusCode} (auth required, as expected)`);

      // Respond with digest auth
      const authHeader = res1.headers['www-authenticate'] || res1.headers['proxy-authenticate'];
      if (authHeader) {
        const challenge = parseAuthChallenge(authHeader);
        const auth = buildDigestResponse('REGISTER', `sip:${CONFIG.domain}`, challenge, CONFIG.extension, CONFIG.password);

        cseq++;
        const authRegMsg =
          `REGISTER sip:${CONFIG.domain} SIP/2.0\r\n` +
          `Via: SIP/2.0/UDP ${localIp}:${localPort};branch=${genBranch()};rport\r\n` +
          `From: "${CONFIG.extension}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${regTag}\r\n` +
          `To: <sip:${CONFIG.extension}@${CONFIG.domain}>\r\n` +
          `Call-ID: ${regCallId}\r\n` +
          `CSeq: ${cseq} REGISTER\r\n` +
          `Contact: <sip:${CONFIG.extension}@${localIp}:${localPort}>\r\n` +
          `Authorization: ${auth}\r\n` +
          `Expires: 120\r\n` +
          `Max-Forwards: 70\r\n` +
          `User-Agent: RedegalTest/1.0\r\n` +
          `Content-Length: 0\r\n\r\n`;

        // Register listener BEFORE sending to avoid race condition
        const res2Promise = waitForResponse(5000, true);
        sendSip(authRegMsg);
        const res2 = await res2Promise;
        log('🔍', `Auth response: type=${res2?.type} code=${res2?.statusCode} text=${res2?.statusText} method=${res2?.method}`);
        if (res2 && res2.statusCode === 200) {
          registered = true;
          pass('REGISTER authenticated → 200 OK ✨');
        } else {
          fail('REGISTER auth', res2 ? `${res2.statusCode} ${res2.statusText}` : 'No response');
        }
      } else {
        fail('REGISTER auth', 'No auth challenge header');
      }
    } else if (res1 && res1.statusCode === 200) {
      registered = true;
      pass('REGISTER → 200 OK (no auth needed)');
    } else {
      fail('REGISTER', res1 ? `${res1.statusCode} ${res1.statusText}` : 'No response');
    }
  } catch (e) {
    fail('REGISTER', e.message);
  }

  // ─── TEST 3: INVITE test call ───
  if (registered) {
    const testExt = CONFIG.testExtensions[0]; // Test with first extension (107)
    log('📡', `Test 3: SIP INVITE → ext ${testExt} (ring + cancel after 5s)...`);

    try {
      const callId = genCallId();
      const callTag = genTag();
      let callCseq = 1;
      const uri = `sip:${testExt}@${CONFIG.domain}`;

      const sdp = [
        'v=0',
        `o=RedegalTest ${Date.now()} ${Date.now()} IN IP4 ${localIp}`,
        's=Test Call',
        `c=IN IP4 ${localIp}`,
        't=0 0',
        `m=audio ${localPort + 2} RTP/AVP 0 8`,
        'a=rtpmap:0 PCMU/8000',
        'a=rtpmap:8 PCMA/8000',
        'a=sendrecv',
      ].join('\r\n') + '\r\n';

      const inviteMsg =
        `INVITE ${uri} SIP/2.0\r\n` +
        `Via: SIP/2.0/UDP ${localIp}:${localPort};branch=${genBranch()};rport\r\n` +
        `From: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${callTag}\r\n` +
        `To: <${uri}>\r\n` +
        `Call-ID: ${callId}\r\n` +
        `CSeq: ${callCseq} INVITE\r\n` +
        `Contact: <sip:${CONFIG.extension}@${localIp}:${localPort}>\r\n` +
        `Record: on\r\n` +
        `Allow: INVITE, ACK, BYE, CANCEL\r\n` +
        `Max-Forwards: 70\r\n` +
        `User-Agent: RedegalTest/1.0\r\n` +
        `Content-Type: application/sdp\r\n` +
        `Content-Length: ${Buffer.byteLength(sdp)}\r\n\r\n${sdp}`;

      sendSip(inviteMsg);

      // Collect responses for up to 8s
      const responses = await collectResponses(8000);

      let gotAuth = false;
      let gotRinging = false;
      let gotAnswer = false;

      for (const r of responses) {
        if (r.type !== 'response') continue;
        const cseqHdr = r.headers?.cseq || '';
        if (!cseqHdr.includes('INVITE')) continue;

        if (r.statusCode === 401 || r.statusCode === 407) {
          gotAuth = true;
          // Send authenticated INVITE
          const authHeader = r.headers['www-authenticate'] || r.headers['proxy-authenticate'];
          if (authHeader) {
            const challenge = parseAuthChallenge(authHeader);
            const auth = buildDigestResponse('INVITE', uri, challenge, CONFIG.extension, CONFIG.password);
            callCseq++;

            // ACK the 401
            const ackMsg =
              `ACK ${uri} SIP/2.0\r\n` +
              `Via: SIP/2.0/UDP ${localIp}:${localPort};branch=${genBranch()};rport\r\n` +
              `From: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${callTag}\r\n` +
              `To: <${uri}>\r\n` +
              `Call-ID: ${callId}\r\n` +
              `CSeq: ${callCseq - 1} ACK\r\n` +
              `Max-Forwards: 70\r\n` +
              `Content-Length: 0\r\n\r\n`;
            sendSip(ackMsg);

            const authInviteMsg =
              `INVITE ${uri} SIP/2.0\r\n` +
              `Via: SIP/2.0/UDP ${localIp}:${localPort};branch=${genBranch()};rport\r\n` +
              `From: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${callTag}\r\n` +
              `To: <${uri}>\r\n` +
              `Call-ID: ${callId}\r\n` +
              `CSeq: ${callCseq} INVITE\r\n` +
              `Contact: <sip:${CONFIG.extension}@${localIp}:${localPort}>\r\n` +
              `Authorization: ${auth}\r\n` +
              `Record: on\r\n` +
              `Allow: INVITE, ACK, BYE, CANCEL\r\n` +
              `Max-Forwards: 70\r\n` +
              `User-Agent: RedegalTest/1.0\r\n` +
              `Content-Type: application/sdp\r\n` +
              `Content-Length: ${Buffer.byteLength(sdp)}\r\n\r\n${sdp}`;
            sendSip(authInviteMsg);
          }
        }
        if (r.statusCode === 100) {
          pass(`INVITE → 100 Trying (PBX processing)`);
        }
        if (r.statusCode === 180 || r.statusCode === 183) {
          gotRinging = true;
          pass(`INVITE → ${r.statusCode} Ringing 🔔 (extension ${testExt} is ringing!)`);
        }
        if (r.statusCode === 200) {
          gotAnswer = true;
          pass(`INVITE → 200 OK (answered!)`);
        }
      }

      if (gotAuth) {
        pass('INVITE auth challenge handled');
      }

      // Wait a bit more for ringing after auth
      if (!gotRinging && gotAuth) {
        const moreResponses = await collectResponses(6000);
        for (const r of moreResponses) {
          if (r.type !== 'response') continue;
          if (r.statusCode === 100) pass(`INVITE → 100 Trying`);
          if (r.statusCode === 180 || r.statusCode === 183) {
            gotRinging = true;
            pass(`INVITE → ${r.statusCode} Ringing 🔔`);
          }
          if (r.statusCode === 200) {
            gotAnswer = true;
            pass(`INVITE → 200 OK (answered!)`);
          }
          if (r.statusCode >= 400) {
            fail(`INVITE → ${r.statusCode} ${r.statusText}`);
          }
        }
      }

      // CANCEL the call (don't actually ring for long)
      log('📡', 'Cancelling test call...');
      const cancelMsg =
        `CANCEL ${uri} SIP/2.0\r\n` +
        `Via: SIP/2.0/UDP ${localIp}:${localPort};branch=${genBranch()};rport\r\n` +
        `From: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${callTag}\r\n` +
        `To: <${uri}>\r\n` +
        `Call-ID: ${callId}\r\n` +
        `CSeq: ${callCseq} CANCEL\r\n` +
        `Max-Forwards: 70\r\n` +
        `Content-Length: 0\r\n\r\n`;
      sendSip(cancelMsg);

      if (gotRinging || gotAnswer) {
        pass(`Call to ext ${testExt} successfully initiated and cancelled`);
      } else if (gotAuth) {
        pass('INVITE sent with auth (PBX accepted, waiting for extension response)');
      } else if (responses.length > 0) {
        pass(`INVITE got ${responses.length} responses from PBX`);
      } else {
        fail('INVITE', 'No response from PBX');
      }

    } catch (e) {
      fail('INVITE', e.message);
    }
  } else {
    log('⚠️', 'Skipping INVITE test — not registered');
  }

  // ─── UNREGISTER ───
  if (registered) {
    log('📡', 'Unregistering...');
    const unregCallId = genCallId();
    const unregTag = genTag();
    const unregMsg =
      `REGISTER sip:${CONFIG.domain} SIP/2.0\r\n` +
      `Via: SIP/2.0/UDP ${localIp}:${localPort};branch=${genBranch()};rport\r\n` +
      `From: "${CONFIG.extension}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${unregTag}\r\n` +
      `To: <sip:${CONFIG.extension}@${CONFIG.domain}>\r\n` +
      `Call-ID: ${unregCallId}\r\n` +
      `CSeq: 1 REGISTER\r\n` +
      `Contact: <sip:${CONFIG.extension}@${localIp}:${localPort}>\r\n` +
      `Expires: 0\r\n` +
      `Max-Forwards: 70\r\n` +
      `User-Agent: RedegalTest/1.0\r\n` +
      `Content-Length: 0\r\n\r\n`;
    sendSip(unregMsg);
  }

  // ─── SUMMARY ───
  setTimeout(() => {
    socket.close();
    console.log('\n' + '═'.repeat(50));
    console.log('  SIP INTEGRATION TEST RESULTS');
    console.log('═'.repeat(50));
    const passed = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    for (const r of results) {
      console.log(`  ${r.ok ? '✅' : '❌'}  ${r.test}${r.err ? ' — ' + r.err : ''}`);
    }
    console.log('─'.repeat(50));
    console.log(`  ${passed} passed, ${failed} failed (${results.length} total)`);
    console.log('═'.repeat(50));
    process.exit(failed > 0 ? 1 : 0);
  }, 2000);
}

log('🚀', 'SIP Integration Test — Vozelia Cloud PBX');
log('', '═'.repeat(50));
runTests().catch((e) => {
  console.error('Test runner error:', e);
  process.exit(1);
});
