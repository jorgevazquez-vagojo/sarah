#!/usr/bin/env node
/**
 * SIP Call Test — Two sequential calls with TTS audio
 * Calls: 634505810 and 617550070
 */

const dgram = require('dgram');
const crypto = require('crypto');
const os = require('os');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  domain: 'cloudpbx1584.vozelia.com',
  port: 5060,
  extension: '108',
  password: '0H1Yq88OTjLBlcL',
  callerIdName: 'Boostic Web',
  ttsMessage: 'Hola, buenas tardes. Le llamo de parte de Redegal para hablarle de Shopify Plus, la solución enterprise para ecommerce. Con Shopify Plus tendrá un checkout personalizable, automatizaciones avanzadas, y soporte dedicado 24 7. Además, nuestro equipo se encarga de toda la migración. ¿Le interesaría una demo sin compromiso? Llámenos al 988 614 012.',
  ttsVoice: 'Mónica',
  targets: [
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

function linearToUlaw(sample) {
  const BIAS = 0x84;
  const CLIP = 32635;
  const sign = (sample >> 8) & 0x80;
  if (sign !== 0) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample += BIAS;
  let exponent = 7;
  const mask = 0x4000;
  for (let i = 0; i < 7; i++) {
    if (sample & (mask >> i)) break;
    exponent--;
  }
  const mantissa = (sample >> (exponent + 3)) & 0x0F;
  const ulawByte = ~(sign | (exponent << 4) | mantissa) & 0xFF;
  return ulawByte;
}

function generateAudio() {
  const tmpDir = '/tmp';
  const aiffFile = path.join(tmpDir, 'test-tts.aiff');
  const ulawFile = path.join(tmpDir, 'test-tts-ulaw.wav');

  log('🎤', `Generando TTS: "${CONFIG.ttsMessage}"`);
  execSync(`say -v "${CONFIG.ttsVoice}" "${CONFIG.ttsMessage}" -o "${aiffFile}"`, { timeout: 15000 });

  // Convert directly to u-law 8kHz mono using macOS afconvert (no manual conversion)
  execSync(`afconvert -f WAVE -d ulaw@8000 -c 1 "${aiffFile}" "${ulawFile}"`, { timeout: 10000 });

  const wavData = fs.readFileSync(ulawFile);
  // WAV header is 44 bytes; the rest is raw u-law samples (1 byte each)
  const audioData = wavData.subarray(44);

  try { fs.unlinkSync(aiffFile); } catch {}
  try { fs.unlinkSync(ulawFile); } catch {}

  log('🎤', `Audio: ${audioData.length} muestras (${(audioData.length / 8000).toFixed(1)}s) — native u-law`);
  return audioData;
}

function sendRtpAudio(rtpSocket, remoteIp, remotePort, audioData) {
  return new Promise((resolve) => {
    const PACKET_SIZE = 160;
    const PACKET_INTERVAL = 20;
    const ssrc = crypto.randomBytes(4).readUInt32BE(0);

    // Prepend 500ms of silence (u-law silence = 0xFF) to let phone setup
    const silence = Buffer.alloc(4000, 0xFF); // 500ms @ 8kHz
    const fullAudio = Buffer.concat([silence, audioData]);

    let seq = 0, timestamp = 0, offset = 0;
    let isFirst = true;

    log('🔊', `RTP → ${remoteIp}:${remotePort} (${(fullAudio.length / 8000).toFixed(1)}s incl silence)`);

    const interval = setInterval(() => {
      if (offset >= fullAudio.length) {
        clearInterval(interval);
        log('🔊', 'Audio enviado');
        resolve();
        return;
      }
      const chunk = fullAudio.subarray(offset, offset + PACKET_SIZE);
      offset += PACKET_SIZE;

      const header = Buffer.alloc(12);
      header[0] = 0x80; // Version 2
      header[1] = 0x00; // Payload type 0 (PCMU)
      // Marker bit on FIRST packet (start of talk spurt per RFC 3550)
      if (isFirst) { header[1] |= 0x80; isFirst = false; }
      header.writeUInt16BE(seq & 0xFFFF, 2);
      header.writeUInt32BE(timestamp, 4);
      header.writeUInt32BE(ssrc, 8);

      rtpSocket.send(Buffer.concat([header, chunk]), 0, 12 + chunk.length, remotePort, remoteIp);
      seq++;
      timestamp += PACKET_SIZE;
    }, PACKET_INTERVAL);
  });
}

async function makeCall(sipSocket, rtpSocket, localIp, sipPort, rtpPort, targetNumber, targetName, audioData) {
  log('📞', `═══ Llamando a ${targetName} (+${targetNumber}) ═══`);

  function sendSip(msg) {
    sipSocket.send(Buffer.from(msg), 0, Buffer.byteLength(msg), CONFIG.port, CONFIG.domain);
  }

  const callId = genCallId();

  // Filter responses by Call-ID to avoid cross-call interference
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
          sendSip(
            `SIP/2.0 200 OK\r\nVia: ${parsed.headers['via']}\r\nFrom: ${parsed.headers['from']}\r\nTo: ${parsed.headers['to']}\r\nCall-ID: ${parsed.headers['call-id']}\r\nCSeq: ${parsed.headers['cseq']}\r\nContent-Length: 0\r\n\r\n`
          );
          return;
        }
        if (parsed.type !== 'response') return;
        // CRITICAL: only accept responses for THIS call
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

  const sdp = [
    'v=0',
    `o=BoosticBot ${Date.now()} ${Date.now()} IN IP4 ${localIp}`,
    's=RDGPhone',
    `c=IN IP4 ${localIp}`,
    't=0 0',
    `m=audio ${rtpPort} RTP/AVP 0`,
    'a=rtpmap:0 PCMU/8000',
    'a=ptime:20',
    'a=sendrecv',
  ].join('\r\n') + '\r\n';

  // INVITE
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
  log('🔍', `${res.statusCode} ${res.statusText}`);

  // Auth challenge
  if (res.statusCode === 407 || res.statusCode === 401) {
    const is407 = res.statusCode === 407;
    const authHeader = is407 ? res.headers['proxy-authenticate'] : res.headers['www-authenticate'];
    const challenge = parseAuthChallenge(authHeader);

    sendSip(
      `ACK ${targetUri} SIP/2.0\r\n` +
      `Via: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\n` +
      `From: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${callTag}\r\n` +
      `To: <${targetUri}>\r\n` +
      `Call-ID: ${callId}\r\n` +
      `CSeq: ${cseq} ACK\r\n` +
      `Max-Forwards: 70\r\n` +
      `Content-Length: 0\r\n\r\n`
    );

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
    log('🔍', `Auth: ${res.statusCode} ${res.statusText}`);
  }

  // Ringing → wait for answer
  if (res.statusCode === 180 || res.statusCode === 183) {
    log('🔔', 'Sonando...');
    try {
      res = await waitForCallResponse(30000, [100]);
      log('🔍', `${res.statusCode} ${res.statusText}`);
    } catch {
      log('⏰', 'No contesto. Cancelando...');
      sendSip(
        `CANCEL ${targetUri} SIP/2.0\r\n` +
        `Via: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\n` +
        `From: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${callTag}\r\n` +
        `To: <${targetUri}>\r\n` +
        `Call-ID: ${callId}\r\n` +
        `CSeq: ${cseq} CANCEL\r\n` +
        `Max-Forwards: 70\r\n` +
        `Content-Length: 0\r\n\r\n`
      );
      // Drain CANCEL responses (200 OK to CANCEL + 487 Request Terminated)
      await new Promise((r) => setTimeout(r, 2000));
      // Flush any pending messages
      sipSocket.removeAllListeners('message');
      return false;
    }
  }

  // Answered → send audio
  if (res.statusCode === 200) {
    log('✅', `${targetName} contesto!`);

    let remoteIp = localIp, remoteRtpPort = 0;
    if (res.body) {
      const cMatch = res.body.match(/c=IN IP4 (\S+)/);
      if (cMatch) remoteIp = cMatch[1];
      const mMatch = res.body.match(/m=audio (\d+)/);
      if (mMatch) remoteRtpPort = parseInt(mMatch[1]);
    }

    // ACK
    sendSip(
      `ACK ${targetUri} SIP/2.0\r\n` +
      `Via: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\n` +
      `From: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${callTag}\r\n` +
      `To: ${res.headers.to}\r\n` +
      `Call-ID: ${callId}\r\n` +
      `CSeq: ${cseq} ACK\r\n` +
      `Max-Forwards: 70\r\n` +
      `Content-Length: 0\r\n\r\n`
    );

    if (remoteRtpPort > 0) {
      await sendRtpAudio(rtpSocket, remoteIp, remoteRtpPort, audioData);
      await new Promise((r) => setTimeout(r, 1000));
    } else {
      log('⚠️', 'No RTP port in SDP');
      await new Promise((r) => setTimeout(r, 3000));
    }

    // BYE
    sendSip(
      `BYE ${targetUri} SIP/2.0\r\n` +
      `Via: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\n` +
      `From: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${callTag}\r\n` +
      `To: ${res.headers.to}\r\n` +
      `Call-ID: ${callId}\r\n` +
      `CSeq: ${cseq + 1} BYE\r\n` +
      `Max-Forwards: 70\r\n` +
      `Content-Length: 0\r\n\r\n`
    );
    log('✅', `Llamada a ${targetName} completada con audio`);
    return true;
  }

  log('❌', `Error con ${targetName}: ${res.statusCode} ${res.statusText}`);
  return false;
}

async function run() {
  const audioData = generateAudio();
  const localIp = getLocalIp();
  const sipSocket = dgram.createSocket('udp4');
  const rtpSocket = dgram.createSocket('udp4');

  await new Promise((resolve) => sipSocket.bind(0, resolve));
  const sipPort = sipSocket.address().port;
  await new Promise((resolve) => rtpSocket.bind(0, resolve));
  const rtpPort = rtpSocket.address().port;

  log('🔧', `PBX: ${CONFIG.domain} | Ext: ${CONFIG.extension} | IP: ${localIp}`);
  log('🔧', `SIP: ${sipPort}, RTP: ${rtpPort}`);

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
          sendSip(
            `SIP/2.0 200 OK\r\nVia: ${parsed.headers['via']}\r\nFrom: ${parsed.headers['from']}\r\nTo: ${parsed.headers['to']}\r\nCall-ID: ${parsed.headers['call-id']}\r\nCSeq: ${parsed.headers['cseq']}\r\nContent-Length: 0\r\n\r\n`
          );
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
    sipSocket.close(); rtpSocket.close();
    process.exit(1);
  }
  log('✅', 'Registrado');

  // Call each target sequentially
  for (const target of CONFIG.targets) {
    console.log('');
    await makeCall(sipSocket, rtpSocket, localIp, sipPort, rtpPort, target.number, target.name, audioData);
    // Wait 3s between calls
    if (CONFIG.targets.indexOf(target) < CONFIG.targets.length - 1) {
      log('⏳', 'Esperando 3s antes de la siguiente llamada...');
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  // Unregister + cleanup
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
      console.log('  AMBAS LLAMADAS COMPLETADAS');
      console.log('═══════════════════════════════════');
      sipSocket.close(); rtpSocket.close();
      process.exit(0);
    }, 2000);
  }, 2000);
}

log('📞', 'RDGPhone: 2 llamadas con TTS de Jorge');
log('', '═'.repeat(50));
run().catch((e) => { console.error('Error:', e); process.exit(1); });
