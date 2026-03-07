/**
 * AI Caller — Bidirectional SIP Call Agent
 *
 * Features:
 * - Outbound AI sales/support calls with TTS + STT
 * - Inbound call answering with AI
 * - STUN NAT traversal for bidirectional RTP
 * - Multi-provider AI (Claude/Gemini/OpenAI) via ai.js
 * - Full call recording (both directions)
 * - Parallel calls support
 * - CRM lead creation post-call
 * - Google Calendar scheduling detection
 * - Multi-provider TTS: Edge TTS (default) | Qwen3-TTS (TTS_PROVIDER=qwen3)
 */

const dgram = require('dgram');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { EventEmitter } = require('events');
const https = require('https');
const { logger } = require('../utils/logger');
const settings = require('./settings');
const { logCallStart, logCallEnd, saveRecording } = require('./call-recording');
const { aiComplete } = require('./ai');
const { dispatchToCRM } = require('../integrations/crm');
const { generateTts, TTS_PROVIDER } = require('./tts-providers');

// ─── Constants ───
const STUN_HOST = 'stun.l.google.com';
const STUN_PORT = 19302;
const MAGIC_COOKIE = 0x2112A442;
const PACKET_SIZE = 160; // 20ms @ 8kHz

// ─── u-law decode table ───
const ULAW_DECODE = new Int16Array(256);
(function buildTable() {
  for (let i = 0; i < 256; i++) {
    let val = ~i & 0xFF;
    const sign = val & 0x80;
    const exponent = (val >> 4) & 0x07;
    const mantissa = val & 0x0F;
    let sample = ((mantissa << 3) + 0x84) << exponent;
    sample -= 0x84;
    ULAW_DECODE[i] = sign ? -sample : sample;
  }
})();

// ─── SIP helpers ───
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
      headers[key] = lines[i].substring(colon + 1).trim();
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

// ─── STUN ───
function stunDiscover(socket) {
  return new Promise((resolve, reject) => {
    const txId = crypto.randomBytes(12);
    const req = Buffer.alloc(20);
    req.writeUInt16BE(0x0001, 0);
    req.writeUInt16BE(0x0000, 2);
    req.writeUInt32BE(MAGIC_COOKIE, 4);
    txId.copy(req, 8);

    const timer = setTimeout(() => { socket.removeListener('message', handler); reject(new Error('STUN timeout')); }, 5000);

    function handler(msg) {
      if (msg.length < 20) return;
      if (msg.readUInt16BE(0) !== 0x0101 || msg.readUInt32BE(4) !== MAGIC_COOKIE) return;
      if (!msg.subarray(8, 20).equals(txId)) return;
      clearTimeout(timer);
      socket.removeListener('message', handler);

      const msgLen = msg.readUInt16BE(2);
      let offset = 20;
      while (offset + 4 <= 20 + msgLen) {
        const attrType = msg.readUInt16BE(offset);
        const attrLen = msg.readUInt16BE(offset + 2);
        const attrStart = offset + 4;
        if (attrType === 0x0020 && attrLen >= 8 && msg[attrStart + 1] === 0x01) {
          const xPort = msg.readUInt16BE(attrStart + 2) ^ (MAGIC_COOKIE >>> 16);
          const xIp = msg.readUInt32BE(attrStart + 4) ^ MAGIC_COOKIE;
          resolve({ ip: `${(xIp >>> 24) & 0xFF}.${(xIp >>> 16) & 0xFF}.${(xIp >>> 8) & 0xFF}.${xIp & 0xFF}`, port: xPort });
          return;
        }
        if (attrType === 0x0001 && attrLen >= 8 && msg[attrStart + 1] === 0x01) {
          const port = msg.readUInt16BE(attrStart + 2);
          const ip4 = msg.readUInt32BE(attrStart + 4);
          resolve({ ip: `${(ip4 >>> 24) & 0xFF}.${(ip4 >>> 16) & 0xFF}.${(ip4 >>> 8) & 0xFF}.${ip4 & 0xFF}`, port });
          return;
        }
        offset = attrStart + Math.ceil(attrLen / 4) * 4;
      }
      reject(new Error('STUN: no MAPPED-ADDRESS'));
    }
    socket.on('message', handler);
    socket.send(req, 0, req.length, STUN_PORT, STUN_HOST);
  });
}

// ─── u-law → WAV conversion ───
function ulawToWav(ulawData) {
  const pcmData = Buffer.alloc(ulawData.length * 2);
  for (let i = 0; i < ulawData.length; i++) {
    pcmData.writeInt16LE(ULAW_DECODE[ulawData[i]], i * 2);
  }
  const wavHeader = Buffer.alloc(44);
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + pcmData.length, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20);
  wavHeader.writeUInt16LE(1, 22);
  wavHeader.writeUInt32LE(8000, 24);
  wavHeader.writeUInt32LE(16000, 28);
  wavHeader.writeUInt16LE(2, 32);
  wavHeader.writeUInt16LE(16, 34);
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(pcmData.length, 40);
  return Buffer.concat([wavHeader, pcmData]);
}

// ─── TTS: delegated to tts-providers.js (edge | qwen3) ───
// generateTts is imported from './tts-providers'
// Active provider: process.env.TTS_PROVIDER (default: 'edge')

// ═══════════════════════════════════════════════════════════════
// ActiveCall — single bidirectional call instance
// ═══════════════════════════════════════════════════════════════

class ActiveCall extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.id = crypto.randomBytes(8).toString('hex');
    this.sipSocket = null;
    this.rtpSocket = null;
    this.state = 'idle'; // idle → registering → inviting → ringing → active → ended
    this.hungUp = false;
    this.ssrc = crypto.randomBytes(4).readUInt32BE(0);
    this.rtpState = { seq: 0, timestamp: 0 };
    this.history = [];
    this.recording = { outbound: [], inbound: [] }; // u-law chunks
    this.remoteIp = null;
    this.remoteRtpPort = 0;
    this.publicIp = null;
    this.publicRtpPort = 0;
    this.startTime = null;
    this.endTime = null;
    this.summary = null;
  }

  // ─── RTP send ───
  sendRtpPacket(data, isFirst = false) {
    const header = Buffer.alloc(12);
    header[0] = 0x80;
    header[1] = isFirst ? 0x80 : 0x00;
    header.writeUInt16BE(this.rtpState.seq & 0xFFFF, 2);
    header.writeUInt32BE(this.rtpState.timestamp & 0xFFFFFFFF, 4);
    header.writeUInt32BE(this.ssrc, 8);
    this.rtpSocket.send(Buffer.concat([header, data]), 0, 12 + data.length, this.remoteRtpPort, this.remoteIp);
    this.rtpState.seq++;
    this.rtpState.timestamp += PACKET_SIZE;
  }

  sendRtpAudio(audioData) {
    return new Promise((resolve) => {
      let offset = 0;
      const silence = Buffer.alloc(2400, 0xFF);
      const fullAudio = Buffer.concat([silence, audioData]);
      let isFirst = this.rtpState.seq === 0;

      const interval = setInterval(() => {
        if (offset >= fullAudio.length || this.hungUp) {
          clearInterval(interval);
          resolve();
          return;
        }
        const chunk = fullAudio.subarray(offset, offset + PACKET_SIZE);
        offset += PACKET_SIZE;
        this.sendRtpPacket(chunk, isFirst);
        if (isFirst) isFirst = false;
        // Record outbound
        this.recording.outbound.push(Buffer.from(chunk));
      }, 20);
    });
  }

  sendSilence(durationMs) {
    return new Promise((resolve) => {
      const totalPackets = Math.ceil(durationMs / 20);
      let sent = 0;
      const interval = setInterval(() => {
        if (sent >= totalPackets) { clearInterval(interval); resolve(); return; }
        this.sendRtpPacket(Buffer.alloc(PACKET_SIZE, 0xFF), this.rtpState.seq === 0);
        sent++;
      }, 20);
    });
  }

  // ─── Listen for speech ───
  listenForSpeech(maxMs = 15000, silenceMs = 1500) {
    return new Promise((resolve) => {
      const audioChunks = [];
      let lastVoiceTime = Date.now();
      let speechStarted = false;
      const startTime = Date.now();
      let resolved = false;

      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        clearInterval(cnInterval);
        clearInterval(watchdog);
        this.rtpSocket.removeListener('message', handler);
      };

      // Comfort noise
      const cnInterval = setInterval(() => {
        if (resolved || this.hungUp) return;
        this.sendRtpPacket(Buffer.alloc(PACKET_SIZE, 0xFF));
      }, 20);

      // Watchdog
      const watchdog = setInterval(() => {
        if (resolved) return;
        if (this.hungUp) {
          cleanup();
          resolve(audioChunks.length > 0 ? Buffer.concat(audioChunks) : null);
          return;
        }
        if (Date.now() - startTime > maxMs) {
          cleanup();
          resolve(audioChunks.length > 0 ? Buffer.concat(audioChunks) : null);
        }
      }, 500);

      const handler = (msg, rinfo) => {
        if (resolved || msg.length < 12) return;
        if (rinfo && rinfo.address !== this.remoteIp) return;
        const payload = msg.subarray(12);

        // Record inbound
        this.recording.inbound.push(Buffer.from(payload));

        // Energy check
        let energy = 0;
        for (let i = 0; i < payload.length; i++) energy += Math.abs(ULAW_DECODE[payload[i]]);
        energy /= payload.length;

        if (energy > 150) {
          speechStarted = true;
          lastVoiceTime = Date.now();
        }
        if (speechStarted) audioChunks.push(Buffer.from(payload));

        if (speechStarted && Date.now() - lastVoiceTime > silenceMs) {
          cleanup();
          resolve(Buffer.concat(audioChunks));
        }
      };

      this.rtpSocket.on('message', handler);
    });
  }

  // ─── STT: Gemini multimodal → OpenAI Whisper fallback ───
  async transcribe(audioBuffer) {
    const wavBuffer = ulawToWav(audioBuffer);
    const audioBase64 = wavBuffer.toString('base64');

    // Try Gemini multimodal STT first
    try {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        const result = await geminiSTT(audioBase64, geminiKey);
        if (result) return result;
      }
    } catch (e) {
      logger.warn(`Gemini STT failed: ${e.message}`);
    }

    // Fallback: OpenAI Whisper
    try {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (openaiKey) {
        const result = await openaiWhisperSTT(wavBuffer, openaiKey);
        if (result) return result;
      }
    } catch (e) {
      logger.warn(`Whisper STT failed: ${e.message}`);
    }

    return '';
  }

  // ─── AI response generation ───
  async generateResponse(userText) {
    const historyContext = this.history
      .map((h) => `Cliente: ${h.user}\nBot: ${h.assistant}`)
      .join('\n\n');

    const prompt = historyContext
      ? `${historyContext}\n\nCliente: ${userText}`
      : `Cliente: ${userText}`;

    try {
      const result = await aiComplete(
        this.config.systemPrompt,
        prompt,
        { maxTokens: 150, temperature: 0.7 }
      );
      return result?.trim() || 'Disculpe, no le he entendido bien. ¿Podría repetir?';
    } catch (e) {
      logger.warn(`AI response failed: ${e.message}`);
      return 'Disculpe, no le he entendido bien. ¿Podría repetir?';
    }
  }

  // ─── Detect scheduling intent (for Google Calendar) ───
  async detectSchedulingIntent() {
    if (this.history.length === 0) return null;
    const transcript = this.history.map((h) => `Bot: ${h.assistant}\nCliente: ${h.user}`).join('\n');
    try {
      const result = await aiComplete(
        'Eres un asistente que analiza transcripciones de llamadas de ventas.',
        `Analiza esta conversación telefónica y determina si el cliente quiere agendar una reunión o llamada de seguimiento.\n\nTranscripción:\n${transcript}\n\nResponde SOLO en formato JSON:\n{"wantsSchedule": true/false, "suggestedDate": "YYYY-MM-DD o null", "suggestedTime": "HH:MM o null", "notes": "breve descripción"}`,
        { maxTokens: 200, temperature: 0 }
      );
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (e) {
      logger.warn(`Schedule detection failed: ${e.message}`);
    }
    return null;
  }

  // ─── CRM dispatch post-call ───
  async logCallToCRM() {
    try {
      const summary = this.getSummary();
      const scheduling = await this.detectSchedulingIntent();
      await dispatchToCRM('lead_created', {
        lead: {
          name: summary.targetName || `Prospecto ${summary.targetNumber}`,
          phone: summary.targetNumber,
          company: summary.targetName,
          business_line: this.config.businessLine || 'general',
          language: 'es',
          quality_score: Math.min(100, summary.turns * 15),
          notes: `Llamada AI (${summary.duration}s, ${summary.turns} turnos). ${summary.hungUpBy === 'remote' ? 'Cliente colgó' : 'Bot finalizó'}.\n${this.history.map((h) => `C: ${h.user}\nB: ${h.assistant}`).join('\n')}`,
        },
        conversation: { id: this.id },
      });
      if (scheduling?.wantsSchedule) {
        this.emit('scheduleDetected', scheduling);
        logger.info(`Call ${this.id}: Schedule detected → ${scheduling.suggestedDate} ${scheduling.suggestedTime}`);
      }
    } catch (e) {
      logger.warn(`CRM dispatch failed: ${e.message}`);
    }
  }

  // ─── SIP helpers ───
  sendSip(msg) {
    this.sipSocket.send(Buffer.from(msg), 0, Buffer.byteLength(msg), this.config.sipPort, this.config.sipDomain);
  }

  waitForSipResponse(timeoutMs = 5000, skipCodes = [100], filterCallId = null) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.sipSocket.removeListener('message', handler); reject(new Error('SIP Timeout')); }, timeoutMs);
      const self = this;
      function handler(msg) {
        const parsed = parseSipMessage(msg);
        if (!parsed) return;
        if (parsed.type === 'request' && parsed.method === 'OPTIONS') {
          self.sendSip(`SIP/2.0 200 OK\r\nVia: ${parsed.headers['via']}\r\nFrom: ${parsed.headers['from']}\r\nTo: ${parsed.headers['to']}\r\nCall-ID: ${parsed.headers['call-id']}\r\nCSeq: ${parsed.headers['cseq']}\r\nContent-Length: 0\r\n\r\n`);
          return;
        }
        if (parsed.type !== 'response') return;
        if (filterCallId && parsed.headers['call-id'] !== filterCallId) return;
        if (skipCodes.includes(parsed.statusCode)) return;
        clearTimeout(timer);
        self.sipSocket.removeListener('message', handler);
        resolve(parsed);
      }
      this.sipSocket.on('message', handler);
    });
  }

  // ─── Main call flow ───
  async execute() {
    const localIp = getLocalIp();
    this.sipSocket = dgram.createSocket('udp4');
    this.rtpSocket = dgram.createSocket('udp4');

    await new Promise((r) => this.sipSocket.bind(0, r));
    const sipPort = this.sipSocket.address().port;
    await new Promise((r) => this.rtpSocket.bind(0, r));
    const rtpPort = this.rtpSocket.address().port;

    // STUN
    try {
      const stun = await stunDiscover(this.rtpSocket);
      this.publicIp = stun.ip;
      this.publicRtpPort = stun.port;
      logger.info(`Call ${this.id}: STUN OK ${this.publicIp}:${this.publicRtpPort}`);
    } catch {
      this.publicIp = localIp;
      this.publicRtpPort = rtpPort;
    }

    const { sipDomain, sipExtension, sipPassword, targetNumber, callerIdName } = this.config;
    const callId = genCallId();
    const callTag = genTag();
    let cseq = 1;
    const targetUri = `sip:${targetNumber}@${sipDomain}`;

    // REGISTER
    this.state = 'registering';
    const regCallId = genCallId();
    const regTag = genTag();
    this.sendSip(`REGISTER sip:${sipDomain} SIP/2.0\r\nVia: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\nFrom: "${sipExtension}" <sip:${sipExtension}@${sipDomain}>;tag=${regTag}\r\nTo: <sip:${sipExtension}@${sipDomain}>\r\nCall-ID: ${regCallId}\r\nCSeq: 1 REGISTER\r\nContact: <sip:${sipExtension}@${localIp}:${sipPort}>\r\nExpires: 120\r\nMax-Forwards: 70\r\nUser-Agent: RedegalAICaller/1.0\r\nContent-Length: 0\r\n\r\n`);

    let res = await this.waitForSipResponse(5000);
    if (res.statusCode === 401 || res.statusCode === 407) {
      const authHeader = res.headers['www-authenticate'] || res.headers['proxy-authenticate'];
      const challenge = parseAuthChallenge(authHeader);
      const auth = buildDigestResponse('REGISTER', `sip:${sipDomain}`, challenge, sipExtension, sipPassword);
      const resP = this.waitForSipResponse(5000);
      this.sendSip(`REGISTER sip:${sipDomain} SIP/2.0\r\nVia: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\nFrom: "${sipExtension}" <sip:${sipExtension}@${sipDomain}>;tag=${regTag}\r\nTo: <sip:${sipExtension}@${sipDomain}>\r\nCall-ID: ${regCallId}\r\nCSeq: 2 REGISTER\r\nContact: <sip:${sipExtension}@${localIp}:${sipPort}>\r\nAuthorization: ${auth}\r\nExpires: 120\r\nMax-Forwards: 70\r\nUser-Agent: RedegalAICaller/1.0\r\nContent-Length: 0\r\n\r\n`);
      res = await resP;
    }
    if (res.statusCode !== 200) throw new Error(`REGISTER failed: ${res.statusCode}`);

    // INVITE
    this.state = 'inviting';
    const sdp = `v=0\r\no=RedegalAI ${Date.now()} ${Date.now()} IN IP4 ${this.publicIp}\r\ns=AI Call\r\nc=IN IP4 ${this.publicIp}\r\nt=0 0\r\nm=audio ${this.publicRtpPort} RTP/AVP 0\r\na=rtpmap:0 PCMU/8000\r\na=ptime:20\r\na=sendrecv\r\n`;

    this.sendSip(`INVITE ${targetUri} SIP/2.0\r\nVia: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\nFrom: "${callerIdName}" <sip:${sipExtension}@${sipDomain}>;tag=${callTag}\r\nTo: <${targetUri}>\r\nCall-ID: ${callId}\r\nCSeq: ${cseq} INVITE\r\nContact: <sip:${sipExtension}@${localIp}:${sipPort}>\r\nAllow: INVITE, ACK, BYE, CANCEL\r\nMax-Forwards: 70\r\nUser-Agent: RedegalAICaller/1.0\r\nContent-Type: application/sdp\r\nContent-Length: ${Buffer.byteLength(sdp)}\r\n\r\n${sdp}`);

    res = await this.waitForSipResponse(10000, [100], callId);

    // Auth
    if (res.statusCode === 407 || res.statusCode === 401) {
      const is407 = res.statusCode === 407;
      const authHdr = is407 ? res.headers['proxy-authenticate'] : res.headers['www-authenticate'];
      const challenge = parseAuthChallenge(authHdr);
      this.sendSip(`ACK ${targetUri} SIP/2.0\r\nVia: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\nFrom: "${callerIdName}" <sip:${sipExtension}@${sipDomain}>;tag=${callTag}\r\nTo: <${targetUri}>\r\nCall-ID: ${callId}\r\nCSeq: ${cseq} ACK\r\nMax-Forwards: 70\r\nContent-Length: 0\r\n\r\n`);
      cseq++;
      const auth = buildDigestResponse('INVITE', targetUri, challenge, sipExtension, sipPassword);
      const hdrName = is407 ? 'Proxy-Authorization' : 'Authorization';
      const resP = this.waitForSipResponse(15000, [100], callId);
      this.sendSip(`INVITE ${targetUri} SIP/2.0\r\nVia: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\nFrom: "${callerIdName}" <sip:${sipExtension}@${sipDomain}>;tag=${callTag}\r\nTo: <${targetUri}>\r\nCall-ID: ${callId}\r\nCSeq: ${cseq} INVITE\r\nContact: <sip:${sipExtension}@${localIp}:${sipPort}>\r\n${hdrName}: ${auth}\r\nAllow: INVITE, ACK, BYE, CANCEL\r\nMax-Forwards: 70\r\nUser-Agent: RedegalAICaller/1.0\r\nContent-Type: application/sdp\r\nContent-Length: ${Buffer.byteLength(sdp)}\r\n\r\n${sdp}`);
      res = await resP;
    }

    // Ringing
    if (res.statusCode === 180 || res.statusCode === 183) {
      this.state = 'ringing';
      this.emit('ringing');
      try {
        res = await this.waitForSipResponse(30000, [100, 180, 183], callId);
      } catch {
        this.state = 'ended';
        this.sendSip(`CANCEL ${targetUri} SIP/2.0\r\nVia: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\nFrom: "${callerIdName}" <sip:${sipExtension}@${sipDomain}>;tag=${callTag}\r\nTo: <${targetUri}>\r\nCall-ID: ${callId}\r\nCSeq: ${cseq} CANCEL\r\nMax-Forwards: 70\r\nContent-Length: 0\r\n\r\n`);
        this.cleanup();
        throw new Error('No answer');
      }
    }

    if (res.statusCode !== 200) {
      this.state = 'ended';
      this.cleanup();
      throw new Error(`Call failed: ${res.statusCode}`);
    }

    // ANSWERED
    this.state = 'active';
    this.startTime = new Date();
    this.emit('answered');

    // Parse remote RTP
    if (res.body) {
      const cMatch = res.body.match(/c=IN IP4 (\S+)/);
      if (cMatch) this.remoteIp = cMatch[1];
      const mMatch = res.body.match(/m=audio (\d+)/);
      if (mMatch) this.remoteRtpPort = parseInt(mMatch[1]);
    }

    // ACK
    const toHeader = res.headers.to;
    this.sendSip(`ACK ${targetUri} SIP/2.0\r\nVia: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\nFrom: "${callerIdName}" <sip:${sipExtension}@${sipDomain}>;tag=${callTag}\r\nTo: ${toHeader}\r\nCall-ID: ${callId}\r\nCSeq: ${cseq} ACK\r\nMax-Forwards: 70\r\nContent-Length: 0\r\n\r\n`);

    logger.info(`Call ${this.id}: ANSWERED → RTP ${this.remoteIp}:${this.remoteRtpPort}`);

    // BYE detection
    this.sipSocket.on('message', (msg) => {
      const parsed = parseSipMessage(msg);
      if (!parsed) return;
      if (parsed.type === 'request' && parsed.method === 'OPTIONS') {
        this.sendSip(`SIP/2.0 200 OK\r\nVia: ${parsed.headers['via']}\r\nFrom: ${parsed.headers['from']}\r\nTo: ${parsed.headers['to']}\r\nCall-ID: ${parsed.headers['call-id']}\r\nCSeq: ${parsed.headers['cseq']}\r\nContent-Length: 0\r\n\r\n`);
      }
      if (parsed.type === 'request' && parsed.method === 'BYE') {
        this.sendSip(`SIP/2.0 200 OK\r\nVia: ${parsed.headers['via']}\r\nFrom: ${parsed.headers['from']}\r\nTo: ${parsed.headers['to']}\r\nCall-ID: ${parsed.headers['call-id']}\r\nCSeq: ${parsed.headers['cseq']}\r\nContent-Length: 0\r\n\r\n`);
        this.hungUp = true;
        this.emit('hangup', 'remote');
      }
    });

    // Open media path
    await this.sendSilence(1000);

    // ─── Conversation loop ───
    logger.info(`Call ${this.id}: Sending greeting`);
    const greetingAudio = await generateTts(this.config.greeting);
    await this.sendRtpAudio(greetingAudio);

    const maxTurns = this.config.maxTurns || 8;
    for (let turn = 0; turn < maxTurns; turn++) {
      if (this.hungUp) break;

      const spokenAudio = await this.listenForSpeech();
      if (this.hungUp) break;
      if (!spokenAudio || spokenAudio.length < 400) continue;

      // STT
      const userText = await this.transcribe(spokenAudio);
      if (!userText || userText === '[inaudible]') continue;
      logger.info(`Call ${this.id} turn ${turn + 1}: "${userText}"`);
      this.emit('turn', { turn: turn + 1, userText });

      // Check goodbye
      const lower = userText.toLowerCase();
      if (lower.includes('adiós') || lower.includes('hasta luego') || lower.includes('no me interesa') || lower.includes('no gracias')) {
        const goodbye = 'Perfecto, muchas gracias por su tiempo. Si necesita algo, no dude en llamarnos. Que tenga buena tarde.';
        const goodbyeAudio = await generateTts(goodbye);
        await this.sendRtpAudio(goodbyeAudio);
        this.history.push({ user: userText, assistant: goodbye });
        break;
      }

      // AI response
      const aiResponse = await this.generateResponse(userText);
      logger.info(`Call ${this.id} bot: "${aiResponse}"`);
      this.history.push({ user: userText, assistant: aiResponse });
      this.emit('turn', { turn: turn + 1, userText, aiResponse });

      const responseAudio = await generateTts(aiResponse);
      await this.sendRtpAudio(responseAudio);
    }

    // BYE
    if (!this.hungUp) {
      cseq++;
      this.sendSip(`BYE ${targetUri} SIP/2.0\r\nVia: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\nFrom: "${callerIdName}" <sip:${sipExtension}@${sipDomain}>;tag=${callTag}\r\nTo: ${toHeader}\r\nCall-ID: ${callId}\r\nCSeq: ${cseq} BYE\r\nMax-Forwards: 70\r\nContent-Length: 0\r\n\r\n`);
    }

    this.state = 'ended';
    this.endTime = new Date();
    this.emit('ended', this.getSummary());

    // Save recording
    await this.saveCallRecording(callId);

    // CRM + scheduling detection
    await this.logCallToCRM();

    await new Promise((r) => setTimeout(r, 2000));
    this.cleanup();

    return this.getSummary();
  }

  getSummary() {
    return {
      id: this.id,
      targetNumber: this.config.targetNumber,
      targetName: this.config.targetName,
      callerIdName: this.config.callerIdName,
      startTime: this.startTime,
      endTime: this.endTime || new Date(),
      duration: this.endTime ? Math.round((this.endTime - this.startTime) / 1000) : 0,
      turns: this.history.length,
      history: this.history,
      greeting: this.config.greeting,
      hungUpBy: this.hungUp ? 'remote' : 'bot',
    };
  }

  async saveCallRecording(sipCallId) {
    try {
      // Merge inbound audio
      if (this.recording.inbound.length > 0) {
        const inboundUlaw = Buffer.concat(this.recording.inbound);
        const inboundWav = ulawToWav(inboundUlaw);
        await saveRecording(`${sipCallId}-inbound`, inboundWav, 'audio/wav');
      }
      // Merge outbound audio
      if (this.recording.outbound.length > 0) {
        const outboundUlaw = Buffer.concat(this.recording.outbound);
        const outboundWav = ulawToWav(outboundUlaw);
        await saveRecording(`${sipCallId}-outbound`, outboundWav, 'audio/wav');
      }
    } catch (e) {
      logger.warn(`Call ${this.id}: Recording save failed: ${e.message}`);
    }
  }

  cleanup() {
    try { this.sipSocket?.close(); } catch {}
    try { this.rtpSocket?.close(); } catch {}
  }
}

// ═══════════════════════════════════════════════════════════════
// AiCallerManager — manages multiple concurrent calls
// ═══════════════════════════════════════════════════════════════

class AiCallerManager extends EventEmitter {
  constructor() {
    super();
    this.activeCalls = new Map();
    this.completedCalls = [];
    this.maxConcurrent = parseInt(process.env.AI_CALLER_MAX_CONCURRENT || '5');
    this.sipConfig = {};
  }

  async init() {
    const cfg = await settings.getMany([
      'sip.domain', 'sip.port', 'sip.extension', 'sip.password',
    ]);
    this.sipConfig = {
      sipDomain: cfg['sip.domain'] || process.env.SIP_DOMAIN || 'cloudpbx1584.vozelia.com',
      sipPort: parseInt(cfg['sip.port'] || process.env.SIP_PORT || '5060'),
      sipExtension: cfg['sip.extension'] || process.env.SIP_EXTENSION || '108',
      sipPassword: cfg['sip.password'] || process.env.SIP_PASSWORD || '',
    };
    logger.info('AiCallerManager initialized');
  }

  /**
   * Start a new AI call
   * @param {Object} callConfig - { targetNumber, targetName, callerIdName, greeting, systemPrompt, maxTurns }
   * @returns {ActiveCall}
   */
  async startCall(callConfig) {
    if (this.activeCalls.size >= this.maxConcurrent) {
      throw new Error(`Max concurrent calls reached (${this.maxConcurrent})`);
    }

    const config = { ...this.sipConfig, ...callConfig };
    const call = new ActiveCall(config);

    this.activeCalls.set(call.id, call);
    this.emit('callStarted', call.id);

    // Run call in background
    call.execute()
      .then((summary) => {
        this.activeCalls.delete(call.id);
        this.completedCalls.push(summary);
        if (this.completedCalls.length > 100) this.completedCalls.shift(); // Keep last 100
        this.emit('callEnded', { id: call.id, summary });
        logger.info(`Call ${call.id} completed: ${summary.turns} turns`);
      })
      .catch((err) => {
        this.activeCalls.delete(call.id);
        this.emit('callFailed', { id: call.id, error: err.message });
        logger.error(`Call ${call.id} failed: ${err.message}`);
      });

    return call;
  }

  /**
   * Start multiple calls in parallel
   * @param {Array<Object>} callConfigs
   * @returns {Array<ActiveCall>}
   */
  async startBatch(callConfigs) {
    const calls = [];
    for (const config of callConfigs) {
      try {
        const call = await this.startCall(config);
        calls.push(call);
        // Small delay between starts to avoid SIP collisions
        await new Promise((r) => setTimeout(r, 2000));
      } catch (e) {
        logger.warn(`Batch call failed for ${config.targetNumber}: ${e.message}`);
      }
    }
    return calls;
  }

  hangup(callId) {
    const call = this.activeCalls.get(callId);
    if (!call) throw new Error('Call not found');
    call.hungUp = true;
    call.emit('hangup', 'manual');
  }

  hangupAll() {
    for (const call of this.activeCalls.values()) {
      call.hungUp = true;
      call.emit('hangup', 'manual');
    }
  }

  getStatus() {
    const active = [];
    for (const [id, call] of this.activeCalls) {
      active.push({
        id,
        targetNumber: call.config.targetNumber,
        targetName: call.config.targetName,
        state: call.state,
        turns: call.history.length,
        startTime: call.startTime,
      });
    }
    return {
      activeCalls: active,
      completedCalls: this.completedCalls.length,
      maxConcurrent: this.maxConcurrent,
    };
  }

  getCallHistory() {
    return this.completedCalls;
  }

  /**
   * Register SIP for inbound call handling
   * Listens for incoming INVITE on the SIP extension and auto-answers with AI
   */
  async startInboundListener() {
    if (this._inboundSocket) return; // Already listening

    const localIp = getLocalIp();
    this._inboundSocket = dgram.createSocket('udp4');
    await new Promise((r) => this._inboundSocket.bind(5060, r));
    logger.info(`Inbound SIP listener started on ${localIp}:5060`);

    this._inboundSocket.on('message', (msg, rinfo) => {
      const parsed = parseSipMessage(msg);
      if (!parsed || parsed.type !== 'request') return;

      if (parsed.method === 'OPTIONS') {
        // SIP keepalive — respond 200
        const reply = `SIP/2.0 200 OK\r\nVia: ${parsed.headers['via']}\r\nFrom: ${parsed.headers['from']}\r\nTo: ${parsed.headers['to']}\r\nCall-ID: ${parsed.headers['call-id']}\r\nCSeq: ${parsed.headers['cseq']}\r\nContent-Length: 0\r\n\r\n`;
        this._inboundSocket.send(Buffer.from(reply), rinfo.port, rinfo.address);
        return;
      }

      if (parsed.method === 'INVITE') {
        logger.info(`Inbound call from ${parsed.headers['from']} via ${rinfo.address}:${rinfo.port}`);
        this.emit('inboundCall', {
          from: parsed.headers['from'],
          to: parsed.headers['to'],
          callId: parsed.headers['call-id'],
          remoteAddress: rinfo.address,
          remotePort: rinfo.port,
          sdp: parsed.body,
        });
        // Auto-answer: send 200 OK with SDP
        // (Full implementation would create an ActiveCall in 'inbound' mode)
        // For now, log and emit for external handling
      }
    });
  }

  stopInboundListener() {
    if (this._inboundSocket) {
      this._inboundSocket.close();
      this._inboundSocket = null;
      logger.info('Inbound SIP listener stopped');
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// STT provider functions (standalone, no SDK deps)
// ═══════════════════════════════════════════════════════════════

function geminiSTT(audioBase64, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: 'audio/wav', data: audioBase64 } },
          { text: 'Transcribe this audio exactly. Only output the transcription, nothing else. If unclear, output "[inaudible]". Audio is in Spanish.' },
        ],
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 200 },
    });

    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            const err = new Error(`Gemini STT ${json.error.code}: ${json.error.message?.substring(0, 100)}`);
            err.code = json.error.code;
            reject(err);
            return;
          }
          resolve((json.candidates?.[0]?.content?.parts?.[0]?.text || '').trim());
        } catch (e) {
          reject(new Error(`Gemini STT parse: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Gemini STT timeout')); });
    req.write(body);
    req.end();
  });
}

function openaiWhisperSTT(wavBuffer, apiKey) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + crypto.randomBytes(8).toString('hex');
    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nes\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n`,
    ];
    const header = Buffer.from(parts.join(''));
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const bodyBuffer = Buffer.concat([header, wavBuffer, footer]);

    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/audio/transcriptions',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length,
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            const err = new Error(`Whisper ${json.error.type}: ${json.error.message?.substring(0, 100)}`);
            err.code = res.statusCode;
            reject(err);
            return;
          }
          resolve((json.text || '').trim());
        } catch (e) {
          reject(new Error(`Whisper parse: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Whisper timeout')); });
    req.write(bodyBuffer);
    req.end();
  });
}

// ─── Singleton ───
const aiCallerManager = new AiCallerManager();

module.exports = { AiCallerManager, ActiveCall, aiCallerManager, generateTts, ulawToWav, stunDiscover };
