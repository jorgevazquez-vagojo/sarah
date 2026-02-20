#!/usr/bin/env node
/**
 * Delayed SIP Call — waits 1h, then calls 3 numbers.
 * Hangs up immediately when answered (no audio).
 */

const dgram = require('dgram');
const crypto = require('crypto');
const os = require('os');

const CONFIG = {
  domain: 'cloudpbx1584.vozelia.com',
  port: 5060,
  extension: '108',
  password: '0H1Yq88OTjLBlcL',
  callerIdName: 'Boostic Web',
  delayMs: 60 * 60 * 1000, // 1 hour
  targets: [
    { number: '34634505810', name: 'Javi (634)' },
    { number: '34666990023', name: 'Contacto (666)' },
    { number: '34617550070', name: 'Contacto (617)' },
  ],
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
  if (resMatch) return { type: 'response', statusCode: parseInt(resMatch[1]), statusText: resMatch[2], headers, body, raw: str };
  const reqMatch = firstLine.match(/^(\w+)\s+(.+)\s+SIP\/2\.0/);
  if (reqMatch) return { type: 'request', method: reqMatch[1], uri: reqMatch[2], headers, body, raw: str };
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

function log(icon, msg) {
  const time = new Date().toISOString().substr(11, 12);
  console.log(`[${time}] ${icon}  ${msg}`);
}

async function pingCall(sipSocket, localIp, sipPort, targetNumber, targetName) {
  log('📞', `═══ Llamando a ${targetName} (+${targetNumber}) ═══`);

  function sendSip(msg) {
    sipSocket.send(Buffer.from(msg), 0, Buffer.byteLength(msg), CONFIG.port, CONFIG.domain);
  }

  const callId = genCallId();
  const rtpPort = 40000 + Math.floor(Math.random() * 20000);

  function waitForCallResponse(timeoutMs = 5000, skipCodes = [100]) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        sipSocket.removeListener('message', handler);
        reject(new Error('Timeout'));
      }, timeoutMs);
      function handler(msg) {
        const parsed = parseSipMessage(msg);
        if (!parsed) return;
        if (parsed.type === 'request' && parsed.method === 'OPTIONS') {
          sendSip(`SIP/2.0 200 OK\r\nVia: ${parsed.headers['via']}\r\nFrom: ${parsed.headers['from']}\r\nTo: ${parsed.headers['to']}\r\nCall-ID: ${parsed.headers['call-id']}\r\nCSeq: ${parsed.headers['cseq']}\r\nContent-Length: 0\r\n\r\n`);
          return;
        }
        if (parsed.type !== 'response') return;
        if (parsed.headers['call-id'] && parsed.headers['call-id'] !== callId) return;
        if (skipCodes.includes(parsed.statusCode)) return;
        clearTimeout(timer);
        sipSocket.removeListener('message', handler);
        resolve(parsed);
      }
      sipSocket.on('message', handler);
    });
  }

  const callTag = genTag();
  let cseq = 1;
  const targetUri = `sip:${targetNumber}@${CONFIG.domain}`;

  const sdp = `v=0\r\no=PingBot ${Date.now()} ${Date.now()} IN IP4 ${localIp}\r\ns=Ping\r\nc=IN IP4 ${localIp}\r\nt=0 0\r\nm=audio ${rtpPort} RTP/AVP 0\r\na=rtpmap:0 PCMU/8000\r\na=sendrecv\r\n`;

  sendSip(
    `INVITE ${targetUri} SIP/2.0\r\n` +
    `Via: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\n` +
    `From: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${callTag}\r\n` +
    `To: <${targetUri}>\r\n` +
    `Call-ID: ${callId}\r\n` +
    `CSeq: ${cseq} INVITE\r\n` +
    `Contact: <sip:${CONFIG.extension}@${localIp}:${sipPort}>\r\n` +
    `Allow: INVITE, ACK, BYE, CANCEL\r\n` +
    `Max-Forwards: 70\r\n` +
    `User-Agent: BoosticChatbot/1.0\r\n` +
    `Content-Type: application/sdp\r\n` +
    `Content-Length: ${Buffer.byteLength(sdp)}\r\n\r\n${sdp}`
  );

  let res = await waitForCallResponse(10000);

  if (res.statusCode === 407 || res.statusCode === 401) {
    const is407 = res.statusCode === 407;
    const authHeader = is407 ? res.headers['proxy-authenticate'] : res.headers['www-authenticate'];
    const challenge = parseAuthChallenge(authHeader);

    sendSip(`ACK ${targetUri} SIP/2.0\r\nVia: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\nFrom: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${callTag}\r\nTo: <${targetUri}>\r\nCall-ID: ${callId}\r\nCSeq: ${cseq} ACK\r\nMax-Forwards: 70\r\nContent-Length: 0\r\n\r\n`);

    cseq++;
    const auth = buildDigestResponse('INVITE', targetUri, challenge, CONFIG.extension, CONFIG.password);
    const authHdrName = is407 ? 'Proxy-Authorization' : 'Authorization';

    const resPromise = waitForCallResponse(15000);
    sendSip(
      `INVITE ${targetUri} SIP/2.0\r\n` +
      `Via: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\n` +
      `From: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${callTag}\r\n` +
      `To: <${targetUri}>\r\n` +
      `Call-ID: ${callId}\r\n` +
      `CSeq: ${cseq} INVITE\r\n` +
      `Contact: <sip:${CONFIG.extension}@${localIp}:${sipPort}>\r\n` +
      `${authHdrName}: ${auth}\r\n` +
      `Allow: INVITE, ACK, BYE, CANCEL\r\n` +
      `Max-Forwards: 70\r\n` +
      `User-Agent: BoosticChatbot/1.0\r\n` +
      `Content-Type: application/sdp\r\n` +
      `Content-Length: ${Buffer.byteLength(sdp)}\r\n\r\n${sdp}`
    );
    res = await resPromise;
  }

  // Ringing → wait for answer (up to 20s)
  if (res.statusCode === 180 || res.statusCode === 183) {
    log('🔔', `${targetName} sonando...`);
    try {
      res = await waitForCallResponse(20000, [100]);
    } catch {
      log('⏰', `${targetName} no contesto`);
      sendSip(`CANCEL ${targetUri} SIP/2.0\r\nVia: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\nFrom: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${callTag}\r\nTo: <${targetUri}>\r\nCall-ID: ${callId}\r\nCSeq: ${cseq} CANCEL\r\nMax-Forwards: 70\r\nContent-Length: 0\r\n\r\n`);
      await new Promise((r) => setTimeout(r, 2000));
      sipSocket.removeAllListeners('message');
      return false;
    }
  }

  // Answered → immediately hang up
  if (res.statusCode === 200) {
    log('✅', `${targetName} CONTESTO! Colgando inmediatamente...`);

    sendSip(`ACK ${targetUri} SIP/2.0\r\nVia: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\nFrom: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${callTag}\r\nTo: ${res.headers.to}\r\nCall-ID: ${callId}\r\nCSeq: ${cseq} ACK\r\nMax-Forwards: 70\r\nContent-Length: 0\r\n\r\n`);

    // Tiny delay then BYE
    await new Promise((r) => setTimeout(r, 200));

    sendSip(`BYE ${targetUri} SIP/2.0\r\nVia: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\nFrom: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${callTag}\r\nTo: ${res.headers.to}\r\nCall-ID: ${callId}\r\nCSeq: ${cseq + 1} BYE\r\nMax-Forwards: 70\r\nContent-Length: 0\r\n\r\n`);

    log('📞', `${targetName} — llamada ping completada`);
    return true;
  }

  log('❌', `${targetName}: ${res.statusCode} ${res.statusText}`);
  return false;
}

async function run() {
  const callTime = new Date(Date.now() + CONFIG.delayMs);
  log('⏰', `Esperando 1h... Llamadas programadas para ${callTime.toLocaleTimeString('es-ES')}`);

  await new Promise((r) => setTimeout(r, CONFIG.delayMs));

  log('🚀', 'Iniciando ronda de llamadas programadas');

  const localIp = getLocalIp();
  const sipSocket = dgram.createSocket('udp4');
  await new Promise((resolve) => sipSocket.bind(0, resolve));
  const sipPort = sipSocket.address().port;

  function sendSip(msg) {
    sipSocket.send(Buffer.from(msg), 0, Buffer.byteLength(msg), CONFIG.port, CONFIG.domain);
  }

  function waitForSipResponse(timeoutMs = 5000, skipCodes = [100]) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        sipSocket.removeListener('message', handler);
        reject(new Error('Timeout'));
      }, timeoutMs);
      function handler(msg) {
        const parsed = parseSipMessage(msg);
        if (!parsed) return;
        if (parsed.type === 'request' && parsed.method === 'OPTIONS') {
          sendSip(`SIP/2.0 200 OK\r\nVia: ${parsed.headers['via']}\r\nFrom: ${parsed.headers['from']}\r\nTo: ${parsed.headers['to']}\r\nCall-ID: ${parsed.headers['call-id']}\r\nCSeq: ${parsed.headers['cseq']}\r\nContent-Length: 0\r\n\r\n`);
          return;
        }
        if (parsed.type !== 'response') return;
        if (skipCodes.includes(parsed.statusCode)) return;
        clearTimeout(timer);
        sipSocket.removeListener('message', handler);
        resolve(parsed);
      }
      sipSocket.on('message', handler);
    });
  }

  // REGISTER
  log('📡', 'Registrando...');
  const regCallId = genCallId();
  const regTag = genTag();

  sendSip(
    `REGISTER sip:${CONFIG.domain} SIP/2.0\r\n` +
    `Via: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\n` +
    `From: "${CONFIG.extension}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${regTag}\r\n` +
    `To: <sip:${CONFIG.extension}@${CONFIG.domain}>\r\n` +
    `Call-ID: ${regCallId}\r\n` +
    `CSeq: 1 REGISTER\r\n` +
    `Contact: <sip:${CONFIG.extension}@${localIp}:${sipPort}>\r\n` +
    `Expires: 120\r\n` +
    `Max-Forwards: 70\r\n` +
    `User-Agent: BoosticChatbot/1.0\r\n` +
    `Content-Length: 0\r\n\r\n`
  );

  let res = await waitForSipResponse(5000);
  if (res.statusCode === 401 || res.statusCode === 407) {
    const authHeader = res.headers['www-authenticate'] || res.headers['proxy-authenticate'];
    const challenge = parseAuthChallenge(authHeader);
    const auth = buildDigestResponse('REGISTER', `sip:${CONFIG.domain}`, challenge, CONFIG.extension, CONFIG.password);
    const resPromise = waitForSipResponse(5000);
    sendSip(
      `REGISTER sip:${CONFIG.domain} SIP/2.0\r\n` +
      `Via: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\n` +
      `From: "${CONFIG.extension}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${regTag}\r\n` +
      `To: <sip:${CONFIG.extension}@${CONFIG.domain}>\r\n` +
      `Call-ID: ${regCallId}\r\n` +
      `CSeq: 2 REGISTER\r\n` +
      `Contact: <sip:${CONFIG.extension}@${localIp}:${sipPort}>\r\n` +
      `Authorization: ${auth}\r\n` +
      `Expires: 120\r\n` +
      `Max-Forwards: 70\r\n` +
      `User-Agent: BoosticChatbot/1.0\r\n` +
      `Content-Length: 0\r\n\r\n`
    );
    res = await resPromise;
  }

  if (res.statusCode !== 200) {
    log('❌', `REGISTER fallido: ${res.statusCode}`);
    sipSocket.close();
    process.exit(1);
  }
  log('✅', 'Registrado');

  // Call each target
  for (const target of CONFIG.targets) {
    console.log('');
    await pingCall(sipSocket, localIp, sipPort, target.number, target.name);
    await new Promise((r) => setTimeout(r, 3000));
  }

  // Cleanup
  setTimeout(() => {
    sendSip(
      `REGISTER sip:${CONFIG.domain} SIP/2.0\r\n` +
      `Via: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\n` +
      `From: "${CONFIG.extension}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${genTag()}\r\n` +
      `To: <sip:${CONFIG.extension}@${CONFIG.domain}>\r\n` +
      `Call-ID: ${genCallId()}\r\n` +
      `CSeq: 1 REGISTER\r\n` +
      `Contact: <sip:${CONFIG.extension}@${localIp}:${sipPort}>\r\n` +
      `Expires: 0\r\n` +
      `Max-Forwards: 70\r\n` +
      `Content-Length: 0\r\n\r\n`
    );
    setTimeout(() => {
      console.log('\n═══════════════════════════════════');
      console.log('  RONDA DE PING COMPLETADA');
      console.log('═══════════════════════════════════');
      sipSocket.close();
      process.exit(0);
    }, 2000);
  }, 2000);
}

log('⏰', 'Llamadas ping programadas en 1h (contestar → colgar)');
log('📞', `Destinos: ${CONFIG.targets.map(t => t.name).join(', ')}`);
log('', '═'.repeat(50));
run().catch((e) => { console.error('Error:', e); process.exit(1); });
