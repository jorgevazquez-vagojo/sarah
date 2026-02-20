#!/usr/bin/env node
/**
 * SIP Call Test with RTP Audio — External number +34617550070
 *
 * 1. Generates TTS audio with macOS `say`
 * 2. Converts to G.711 u-law (PCMU) raw audio
 * 3. Registers with Vozelia PBX
 * 4. INVITE → external number
 * 5. Sends RTP audio when answered
 * 6. Hangs up after audio finishes
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
  targetNumber: '34617550070', // Without + prefix
  ttsMessage: 'Hola Isabel, soy Jorge haciendo una prueba, no asustarse',
  ttsVoice: 'Mónica', // Spanish voice on macOS (es_ES)
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

// ─── Linear-to-ulaw conversion (G.711 PCMU) ───
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

// ─── Generate TTS audio and convert to PCMU ───
function generateAudio() {
  const tmpDir = '/tmp';
  const aiffFile = path.join(tmpDir, 'test-tts.aiff');
  const rawFile = path.join(tmpDir, 'test-tts-raw.pcm');

  log('🎤', `Generando TTS: "${CONFIG.ttsMessage}"`);
  log('🎤', `Voz: ${CONFIG.ttsVoice}`);

  // Generate AIFF with macOS say
  execSync(`say -v "${CONFIG.ttsVoice}" "${CONFIG.ttsMessage}" -o "${aiffFile}"`, { timeout: 10000 });

  // Convert to raw PCM 16-bit mono 8kHz using afconvert
  execSync(`afconvert -f caff -d LEI16@8000 -c 1 "${aiffFile}" "${rawFile}"`, { timeout: 10000 });

  // Read raw PCM and convert to u-law
  const pcmData = fs.readFileSync(rawFile);

  // Skip CAFF header — find the 'data' chunk
  // Actually, let's use a simpler approach: convert to raw with sox or just read samples
  // afconvert with caff format includes headers, let's use raw format instead
  execSync(`afconvert -f WAVE -d LEI16@8000 -c 1 "${aiffFile}" "${rawFile}.wav"`, { timeout: 10000 });

  const wavData = fs.readFileSync(`${rawFile}.wav`);
  // WAV header is 44 bytes, audio data starts after
  const audioStart = 44;
  const samples = [];
  for (let i = audioStart; i < wavData.length - 1; i += 2) {
    const sample = wavData.readInt16LE(i);
    samples.push(linearToUlaw(sample));
  }

  // Cleanup
  try { fs.unlinkSync(aiffFile); } catch {}
  try { fs.unlinkSync(rawFile); } catch {}
  try { fs.unlinkSync(`${rawFile}.wav`); } catch {}

  log('🎤', `Audio generado: ${samples.length} muestras (${(samples.length / 8000).toFixed(1)}s a 8kHz)`);
  return Buffer.from(samples);
}

// ─── Send RTP audio ───
function sendRtpAudio(rtpSocket, remoteIp, remotePort, audioData) {
  return new Promise((resolve) => {
    const PACKET_SIZE = 160; // 20ms @ 8kHz
    const PACKET_INTERVAL = 20; // ms
    let seq = 0;
    let timestamp = 0;
    const ssrc = crypto.randomBytes(4).readUInt32BE(0);
    let offset = 0;

    log('🔊', `Enviando audio RTP a ${remoteIp}:${remotePort}...`);

    const interval = setInterval(() => {
      if (offset >= audioData.length) {
        clearInterval(interval);
        log('🔊', 'Audio enviado completamente');
        resolve();
        return;
      }

      const chunk = audioData.subarray(offset, offset + PACKET_SIZE);
      offset += PACKET_SIZE;

      // RTP header (12 bytes)
      const header = Buffer.alloc(12);
      header[0] = 0x80; // Version 2
      header[1] = 0x00; // Payload type 0 (PCMU)
      if (offset >= audioData.length) header[1] |= 0x80; // Marker bit on last
      header.writeUInt16BE(seq & 0xFFFF, 2);
      header.writeUInt32BE(timestamp, 4);
      header.writeUInt32BE(ssrc, 8);

      const packet = Buffer.concat([header, chunk]);
      rtpSocket.send(packet, 0, packet.length, remotePort, remoteIp);

      seq++;
      timestamp += PACKET_SIZE;
    }, PACKET_INTERVAL);
  });
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════

async function run() {
  // Step 1: Generate audio
  const audioData = generateAudio();

  const localIp = getLocalIp();
  const sipSocket = dgram.createSocket('udp4');
  const rtpSocket = dgram.createSocket('udp4');

  log('📞', `Llamada a +${CONFIG.targetNumber} (Isabel)`);
  log('🔧', `PBX: ${CONFIG.domain} | Ext: ${CONFIG.extension} | IP: ${localIp}`);
  console.log('');

  await new Promise((resolve) => sipSocket.bind(0, resolve));
  const sipPort = sipSocket.address().port;
  await new Promise((resolve) => rtpSocket.bind(0, resolve));
  const rtpPort = rtpSocket.address().port;
  log('🔧', `SIP port: ${sipPort}, RTP port: ${rtpPort}`);

  function sendSip(msg) {
    const buf = Buffer.from(msg);
    sipSocket.send(buf, 0, buf.length, CONFIG.port, CONFIG.domain);
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
        // Auto-reply to OPTIONS keepalive
        if (parsed.type === 'request' && parsed.method === 'OPTIONS') {
          sendSip(
            `SIP/2.0 200 OK\r\n` +
            `Via: ${parsed.headers['via']}\r\n` +
            `From: ${parsed.headers['from']}\r\n` +
            `To: ${parsed.headers['to']}\r\n` +
            `Call-ID: ${parsed.headers['call-id']}\r\n` +
            `CSeq: ${parsed.headers['cseq']}\r\n` +
            `Content-Length: 0\r\n\r\n`
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

  // ─── REGISTER ───
  log('📡', 'Registrando en PBX...');
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
    log('❌', `REGISTER fallido: ${res.statusCode} ${res.statusText}`);
    sipSocket.close();
    rtpSocket.close();
    process.exit(1);
  }
  log('✅', 'Registrado en PBX');

  // ─── INVITE ───
  const callId = genCallId();
  const callTag = genTag();
  let cseq = 1;
  const targetUri = `sip:${CONFIG.targetNumber}@${CONFIG.domain}`;

  const sdp = [
    'v=0',
    `o=BoosticBot ${Date.now()} ${Date.now()} IN IP4 ${localIp}`,
    's=Boostic Call',
    `c=IN IP4 ${localIp}`,
    't=0 0',
    `m=audio ${rtpPort} RTP/AVP 0`,
    'a=rtpmap:0 PCMU/8000',
    'a=ptime:20',
    'a=sendrecv',
  ].join('\r\n') + '\r\n';

  log('📞', `INVITE → ${targetUri}...`);

  const inviteBranch = genBranch();
  sendSip(
    `INVITE ${targetUri} SIP/2.0\r\n` +
    `Via: SIP/2.0/UDP ${localIp}:${sipPort};branch=${inviteBranch};rport\r\n` +
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

  // Wait for first significant response (skip 100 Trying)
  res = await waitForSipResponse(10000);
  log('🔍', `INVITE response: ${res.statusCode} ${res.statusText}`);

  // Handle auth challenge (407 Proxy Auth Required) — ONLY ONCE
  if (res.statusCode === 407 || res.statusCode === 401) {
    log('🔑', 'Auth challenge para INVITE...');
    // Determine auth type: 401 = Authorization, 407 = Proxy-Authorization
    const is407 = res.statusCode === 407;
    const authHeader = is407 ? res.headers['proxy-authenticate'] : res.headers['www-authenticate'];
    if (!authHeader) {
      log('❌', 'No auth header in challenge');
      sipSocket.close();
      rtpSocket.close();
      process.exit(1);
    }

    const challenge = parseAuthChallenge(authHeader);
    log('🔍', `Realm: ${challenge.realm}, nonce: ${challenge.nonce?.slice(0,16)}...`);

    // ACK the 401/407
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

    const resPromise = waitForSipResponse(15000);
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
    log('🔍', `Auth INVITE response: ${res.statusCode} ${res.statusText}`);

    // If still failing, try internal extension 107 with full auth flow
    if (res.statusCode === 407 || res.statusCode === 401) {
      log('⚠️', `PBX rechaza llamada externa. Probando ext 107 (interna)...`);

      // ACK the failed response
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

      // New INVITE to internal ext 107
      const intUri = `sip:107@${CONFIG.domain}`;
      const intCallId = genCallId();
      const intTag = genTag();
      cseq = 1;

      const intSdp = sdp.replace(`s=Boostic Call`, `s=Boostic Internal Call`);

      sendSip(
        `INVITE ${intUri} SIP/2.0\r\n` +
        `Via: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\n` +
        `From: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${intTag}\r\n` +
        `To: <${intUri}>\r\n` +
        `Call-ID: ${intCallId}\r\n` +
        `CSeq: ${cseq} INVITE\r\n` +
        `Contact: <sip:${CONFIG.extension}@${localIp}:${sipPort}>\r\n` +
        `Allow: INVITE, ACK, BYE, CANCEL\r\n` +
        `Max-Forwards: 70\r\n` +
        `User-Agent: BoosticChatbot/1.0\r\n` +
        `Content-Type: application/sdp\r\n` +
        `Content-Length: ${Buffer.byteLength(intSdp)}\r\n\r\n${intSdp}`
      );

      res = await waitForSipResponse(10000);
      log('🔍', `Ext 107 response: ${res.statusCode} ${res.statusText}`);

      // Handle auth for internal call too
      if (res.statusCode === 401 || res.statusCode === 407) {
        const intIs407 = res.statusCode === 407;
        const intAuthHdr = intIs407 ? res.headers['proxy-authenticate'] : res.headers['www-authenticate'];
        const intChallenge = parseAuthChallenge(intAuthHdr);
        const intAuth = buildDigestResponse('INVITE', intUri, intChallenge, CONFIG.extension, CONFIG.password);
        const intAuthName = intIs407 ? 'Proxy-Authorization' : 'Authorization';

        sendSip(
          `ACK ${intUri} SIP/2.0\r\n` +
          `Via: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\n` +
          `From: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${intTag}\r\n` +
          `To: <${intUri}>\r\n` +
          `Call-ID: ${intCallId}\r\n` +
          `CSeq: ${cseq} ACK\r\n` +
          `Max-Forwards: 70\r\n` +
          `Content-Length: 0\r\n\r\n`
        );

        cseq++;
        const intResPromise = waitForSipResponse(15000);
        sendSip(
          `INVITE ${intUri} SIP/2.0\r\n` +
          `Via: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\n` +
          `From: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${intTag}\r\n` +
          `To: <${intUri}>\r\n` +
          `Call-ID: ${intCallId}\r\n` +
          `CSeq: ${cseq} INVITE\r\n` +
          `Contact: <sip:${CONFIG.extension}@${localIp}:${sipPort}>\r\n` +
          `${intAuthName}: ${intAuth}\r\n` +
          `Allow: INVITE, ACK, BYE, CANCEL\r\n` +
          `Max-Forwards: 70\r\n` +
          `User-Agent: BoosticChatbot/1.0\r\n` +
          `Content-Type: application/sdp\r\n` +
          `Content-Length: ${Buffer.byteLength(intSdp)}\r\n\r\n${intSdp}`
        );

        res = await intResPromise;
        log('🔍', `Ext 107 auth response: ${res.statusCode} ${res.statusText}`);
      }

      // Update targetUri and callId for subsequent operations
      // (the rest of the code uses these for BYE etc)
    }
  }

  // Handle ringing / waiting for answer
  if (res.statusCode === 180 || res.statusCode === 183) {
    log('🔔', 'Telefono sonando!');
    // Wait for 200 OK (answer) — up to 20s
    try {
      res = await waitForSipResponse(20000, [100]);
      log('🔍', `After ringing: ${res.statusCode} ${res.statusText}`);
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
      res = { statusCode: 0 };
    }
  }

  // ─── Call answered? Send RTP audio! ───
  if (res.statusCode === 200) {
    log('✅', 'Llamada contestada!');

    // Parse SDP to find remote RTP address/port
    let remoteIp = localIp;
    let remoteRtpPort = 0;

    if (res.body) {
      const cMatch = res.body.match(/c=IN IP4 (\S+)/);
      if (cMatch) remoteIp = cMatch[1];
      const mMatch = res.body.match(/m=audio (\d+)/);
      if (mMatch) remoteRtpPort = parseInt(mMatch[1]);
    }

    // ACK the 200
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
      log('🔊', `RTP → ${remoteIp}:${remoteRtpPort}`);
      await sendRtpAudio(rtpSocket, remoteIp, remoteRtpPort, audioData);
      // Wait 1s after audio
      await new Promise((r) => setTimeout(r, 1000));
    } else {
      log('⚠️', 'No se pudo determinar puerto RTP remoto del SDP');
      await new Promise((r) => setTimeout(r, 3000));
    }

    // BYE
    log('📞', 'Colgando...');
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
    log('✅', 'Llamada finalizada con audio TTS');
  } else if (res.statusCode >= 400) {
    log('❌', `Error: ${res.statusCode} ${res.statusText}`);
  }

  // Cleanup
  setTimeout(() => {
    // Unregister
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
      console.log('\n═══════════════════════════════════════');
      console.log('  PRUEBA DE LLAMADA COMPLETADA');
      console.log('═══════════════════════════════════════');
      sipSocket.close();
      rtpSocket.close();
      process.exit(0);
    }, 2000);
  }, 2000);
}

log('📞', 'Test de llamada con audio TTS a Isabel');
log('', '═'.repeat(50));
run().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
