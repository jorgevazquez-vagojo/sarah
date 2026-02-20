/**
 * SIP Click2Call — Vozelia Cloud PBX
 *
 * Registers SIP extension on PBX via UDP.
 * Click2Call flow:
 *   1. INVITE visitor's phone from our extension (PBX routes via trunk)
 *   2. Visitor answers → REFER to agent extensions (sequential)
 *   3. PBX bridges visitor ↔ agent, our leg disconnects
 *
 * CallerID on agent's phone: "Lead Web <visitor_phone>"
 * No audio/RTP on our side — PBX handles all media.
 */

const dgram = require('dgram');
const crypto = require('crypto');
const os = require('os');
const { EventEmitter } = require('events');
const { logger } = require('../utils/logger');
const settings = require('./settings');

// ─── Helpers ───

function getLocalIp() {
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return '127.0.0.1';
}

const rHex = (n) => crypto.randomBytes(n).toString('hex');
const genCallId = () => rHex(12);
const genTag = () => rHex(6);
const genBranch = () => 'z9hG4bK' + rHex(8);

// ─── SIP Message Parser ───

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
      if (headers[key]) {
        headers[key] = Array.isArray(headers[key]) ? [...headers[key], val] : [headers[key], val];
      } else {
        headers[key] = val;
      }
    }
  }

  // Response: SIP/2.0 200 OK
  const resMatch = firstLine.match(/^SIP\/2\.0\s+(\d+)\s*(.*)/);
  if (resMatch) {
    return { type: 'response', statusCode: parseInt(resMatch[1]), statusText: resMatch[2], headers, body, raw: str };
  }

  // Request: INVITE sip:... SIP/2.0
  const reqMatch = firstLine.match(/^(\w+)\s+(.+)\s+SIP\/2\.0/);
  if (reqMatch) {
    return { type: 'request', method: reqMatch[1], uri: reqMatch[2], headers, body, raw: str };
  }

  return null;
}

// ─── Digest Auth ───

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

// ─── SIP Message Builder ───

function buildSipRequest(method, uri, opts) {
  const { via, from, to, callId, cseq, contact, auth, authHeader, extraHeaders, body } = opts;
  const bodyStr = body || '';
  let msg = `${method} ${uri} SIP/2.0\r\n`;
  msg += `Via: ${via}\r\n`;
  msg += `From: ${from}\r\n`;
  msg += `To: ${to}\r\n`;
  msg += `Call-ID: ${callId}\r\n`;
  msg += `CSeq: ${cseq} ${method}\r\n`;
  if (contact) msg += `Contact: ${contact}\r\n`;
  if (auth) msg += `${authHeader || 'Authorization'}: ${auth}\r\n`;
  msg += `Max-Forwards: 70\r\n`;
  msg += `User-Agent: RedegalChatbot/1.0\r\n`;
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) msg += `${k}: ${v}\r\n`;
  }
  if (bodyStr) msg += `Content-Type: application/sdp\r\n`;
  msg += `Content-Length: ${Buffer.byteLength(bodyStr)}\r\n`;
  msg += `\r\n`;
  if (bodyStr) msg += bodyStr;
  return msg;
}

function buildSipResponse(statusCode, statusText, req, { contact, body } = {}) {
  const bodyStr = body || '';
  let msg = `SIP/2.0 ${statusCode} ${statusText}\r\n`;
  // Echo Via, From, To, Call-ID, CSeq from request
  const via = req.headers['via'];
  if (Array.isArray(via)) via.forEach((v) => { msg += `Via: ${v}\r\n`; });
  else if (via) msg += `Via: ${via}\r\n`;
  msg += `From: ${req.headers['from']}\r\n`;
  msg += `To: ${req.headers['to']}\r\n`;
  msg += `Call-ID: ${req.headers['call-id']}\r\n`;
  msg += `CSeq: ${req.headers['cseq']}\r\n`;
  if (contact) msg += `Contact: ${contact}\r\n`;
  msg += `Content-Length: ${Buffer.byteLength(bodyStr)}\r\n`;
  msg += `\r\n`;
  if (bodyStr) msg += bodyStr;
  return msg;
}

// ─── Dummy SDP (no real media, PBX handles audio) ───

function buildDummySdp(localIp, rtpPort) {
  return [
    'v=0',
    `o=RedegalBot ${Date.now()} ${Date.now()} IN IP4 ${localIp}`,
    's=Click2Call',
    `c=IN IP4 ${localIp}`,
    't=0 0',
    `m=audio ${rtpPort} RTP/AVP 0 8 101`,
    'a=rtpmap:0 PCMU/8000',
    'a=rtpmap:8 PCMA/8000',
    'a=rtpmap:101 telephone-event/8000',
    'a=fmtp:101 0-16',
    'a=sendrecv',
  ].join('\r\n') + '\r\n';
}

// ═══════════════════════════════════════════════════════════════
// SIP Click2Call Client
// ═══════════════════════════════════════════════════════════════

class SipClick2Call extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.registered = false;
    this.localIp = getLocalIp();
    this.localPort = 0; // assigned by OS
    this.rtpPort = 0;
    this.cseq = 0;
    this.registerCallId = genCallId();
    this.registerTag = genTag();
    this.registerTimer = null;
    this.config = {};
    this.activeCalls = new Map();
  }

  async init() {
    const cfg = await settings.getMany([
      'sip.domain', 'sip.port', 'sip.extension', 'sip.password',
      'click2call.extensions', 'click2call.callerid_name',
    ]);
    this.config = {
      domain: cfg['sip.domain'],
      port: parseInt(cfg['sip.port'] || '5060', 10),
      extension: cfg['sip.extension'],
      password: cfg['sip.password'],
      ringExtensions: (cfg['click2call.extensions'] || '').split(',').map((e) => e.trim()).filter(Boolean),
      callerIdName: cfg['click2call.callerid_name'] || 'Lead Web',
    };

    if (!this.config.domain || !this.config.extension || !this.config.password) {
      logger.warn('SIP: Not configured — set sip.domain, sip.extension, sip.password to enable Click2Call');
      return;
    }

    // Create RTP dummy socket (we listen but don't send audio)
    const rtpSocket = dgram.createSocket('udp4');
    rtpSocket.bind(0, () => {
      this.rtpPort = rtpSocket.address().port;
      rtpSocket.close(); // We just needed a free port
    });

    // Create SIP UDP socket
    this.socket = dgram.createSocket('udp4');

    this.socket.on('message', (msg, rinfo) => {
      try {
        this.handleMessage(msg, rinfo);
      } catch (e) {
        logger.error('SIP: Parse error:', e.message);
      }
    });

    this.socket.on('error', (err) => {
      logger.error('SIP: Socket error:', err.message);
    });

    return new Promise((resolve) => {
      this.socket.bind(0, () => {
        this.localPort = this.socket.address().port;
        // Wait a tick for rtpPort
        setTimeout(async () => {
          if (!this.rtpPort) this.rtpPort = this.localPort + 2;
          logger.info(`SIP: UDP bound on ${this.localIp}:${this.localPort}, RTP port ${this.rtpPort}`);
          await this.register();
          resolve();
        }, 100);
      });
    });
  }

  send(msg) {
    if (!this.socket) return;
    const buf = Buffer.from(msg);
    this.socket.send(buf, 0, buf.length, this.config.port, this.config.domain);
  }

  // ─── REGISTER ───

  async register(auth) {
    this.cseq++;
    const { domain, extension } = this.config;
    const uri = `sip:${domain}`;
    const via = `SIP/2.0/UDP ${this.localIp}:${this.localPort};branch=${genBranch()};rport`;
    const from = `"${extension}" <sip:${extension}@${domain}>;tag=${this.registerTag}`;
    const to = `<sip:${extension}@${domain}>`;
    const contact = `<sip:${extension}@${this.localIp}:${this.localPort}>`;

    const msg = buildSipRequest('REGISTER', uri, {
      via, from, to, callId: this.registerCallId, cseq: this.cseq, contact, auth,
      extraHeaders: { Expires: '300' },
    });

    this.send(msg);
  }

  handleRegisterResponse(res) {
    if (res.statusCode === 401 || res.statusCode === 407) {
      const authHeader = res.headers['www-authenticate'] || res.headers['proxy-authenticate'];
      if (!authHeader) return;
      const challenge = parseAuthChallenge(authHeader);
      const { domain, extension, password } = this.config;
      const auth = buildDigestResponse('REGISTER', `sip:${domain}`, challenge, extension, password);
      this.register(auth);
      return;
    }

    if (res.statusCode === 200) {
      this.registered = true;
      logger.info(`SIP: Registered as ${this.config.extension}@${this.config.domain}`);
      this.emit('registered');
      // Re-register before expiry
      if (this.registerTimer) clearInterval(this.registerTimer);
      this.registerTimer = setInterval(() => this.register(), 240_000); // every 4 min
      return;
    }

    logger.error(`SIP: Registration failed — ${res.statusCode} ${res.statusText}`);
  }

  // ─── INVITE (call visitor) ───

  async originate(visitorPhone) {
    if (!this.registered) {
      throw new Error('SIP not registered');
    }

    const phone = visitorPhone.replace(/[^\d+]/g, '');
    if (phone.length < 6) throw new Error('Invalid phone number');

    const { domain, extension, callerIdName } = this.config;
    const callId = genCallId();
    const tag = genTag();

    const call = {
      callId,
      tag,
      cseq: 1,
      state: 'inviting',
      visitorPhone: phone,
      resolve: null,
      reject: null,
      timer: null,
    };

    const promise = new Promise((resolve, reject) => {
      call.resolve = resolve;
      call.reject = reject;
      call.timer = setTimeout(() => {
        if (call.state === 'inviting' || call.state === 'ringing') {
          this.cancelCall(callId);
          reject(new Error('Call timeout'));
        }
      }, 35_000);
    });

    this.activeCalls.set(callId, call);

    const uri = `sip:${phone}@${domain}`;
    const via = `SIP/2.0/UDP ${this.localIp}:${this.localPort};branch=${genBranch()};rport`;
    const from = `"${callerIdName}" <sip:${extension}@${domain}>;tag=${tag}`;
    const to = `<${uri}>`;
    const contact = `<sip:${extension}@${this.localIp}:${this.localPort}>`;
    const sdp = buildDummySdp(this.localIp, this.rtpPort);

    const msg = buildSipRequest('INVITE', uri, {
      via, from, to, callId, cseq: call.cseq, contact,
      extraHeaders: { Allow: 'INVITE, ACK, BYE, CANCEL, REFER, NOTIFY', Supported: 'replaces' },
      body: sdp,
    });

    call.inviteUri = uri;
    this.send(msg);
    logger.info(`SIP: INVITE ${phone} [${callId}]`);

    return promise;
  }

  handleInviteResponse(res) {
    const callId = res.headers['call-id'];
    const call = this.activeCalls.get(callId);
    if (!call) return;

    // Auth challenge
    if (res.statusCode === 401 || res.statusCode === 407) {
      const hdr = res.headers['www-authenticate'] || res.headers['proxy-authenticate'];
      if (!hdr) return;
      const challenge = parseAuthChallenge(hdr);
      const { extension, password, domain } = this.config;
      call.cseq++;
      const auth = buildDigestResponse('INVITE', call.inviteUri, challenge, extension, password);
      const via = `SIP/2.0/UDP ${this.localIp}:${this.localPort};branch=${genBranch()};rport`;
      const from = `"${this.config.callerIdName}" <sip:${extension}@${domain}>;tag=${call.tag}`;
      const to = `<${call.inviteUri}>`;
      const contact = `<sip:${extension}@${this.localIp}:${this.localPort}>`;
      const sdp = buildDummySdp(this.localIp, this.rtpPort);

      // Send ACK for the 401/407 first
      this.sendAck(call, res);

      const msg = buildSipRequest('INVITE', call.inviteUri, {
        via, from, to, callId, cseq: call.cseq, contact,
        auth, authHeader: res.statusCode === 407 ? 'Proxy-Authorization' : 'Authorization',
        extraHeaders: { Allow: 'INVITE, ACK, BYE, CANCEL, REFER, NOTIFY', Supported: 'replaces' },
        body: sdp,
      });
      this.send(msg);
      return;
    }

    // Provisional (100 Trying, 180 Ringing, 183 Session Progress)
    if (res.statusCode >= 100 && res.statusCode < 200) {
      if (res.statusCode === 180 || res.statusCode === 183) {
        call.state = 'ringing';
        call.toTag = extractTag(res.headers['to']);
        logger.info(`SIP: Ringing — ${call.visitorPhone}`);
      }
      return;
    }

    // 200 OK — Visitor answered!
    if (res.statusCode === 200) {
      call.state = 'answered';
      call.toTag = extractTag(res.headers['to']);
      clearTimeout(call.timer);
      logger.info(`SIP: Visitor answered — ${call.visitorPhone}`);

      // Send ACK
      this.sendAck(call, res);

      // Start transfer to agent extensions
      this.transferToAgents(callId);
      return;
    }

    // Failure
    if (res.statusCode >= 300) {
      call.state = 'failed';
      clearTimeout(call.timer);
      this.activeCalls.delete(callId);
      logger.warn(`SIP: INVITE failed — ${res.statusCode} ${res.statusText}`);
      if (res.statusCode >= 400) this.sendAck(call, res);
      call.reject(new Error(`Call failed: ${res.statusCode} ${res.statusText}`));
    }
  }

  sendAck(call, res) {
    const { domain, extension } = this.config;
    const via = `SIP/2.0/UDP ${this.localIp}:${this.localPort};branch=${genBranch()};rport`;
    const toTag = extractTag(res.headers['to']);
    const toHdr = toTag
      ? `<${call.inviteUri}>;tag=${toTag}`
      : `<${call.inviteUri}>`;
    const msg = buildSipRequest('ACK', call.inviteUri, {
      via,
      from: `"${this.config.callerIdName}" <sip:${extension}@${domain}>;tag=${call.tag}`,
      to: toHdr,
      callId: call.callId,
      cseq: call.cseq,
    });
    this.send(msg);
  }

  // ─── REFER (transfer to agent extensions) ───

  async transferToAgents(callId) {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    const extensions = this.config.ringExtensions;
    if (!extensions.length) {
      logger.warn('SIP: No click2call extensions configured — hanging up');
      this.sendBye(callId);
      call.reject(new Error('No agent extensions configured'));
      return;
    }

    // Try each extension sequentially
    for (const ext of extensions) {
      try {
        logger.info(`SIP: REFER visitor to ext ${ext}`);
        await this.sendRefer(callId, ext);
        // REFER accepted — PBX handles the rest
        call.state = 'transferred';
        call.resolve({ success: true, transferredTo: ext, visitorPhone: call.visitorPhone });
        // Our call leg can be released (PBX keeps the visitor connected to agent)
        setTimeout(() => this.sendBye(callId), 2000);
        return;
      } catch (e) {
        logger.warn(`SIP: REFER to ${ext} failed — ${e.message}`);
        // Try next extension
      }
    }

    // All extensions failed
    logger.error('SIP: All agent extensions failed — hanging up');
    this.sendBye(callId);
    call.reject(new Error('All agent extensions unreachable'));
  }

  sendRefer(callId, targetExt) {
    const call = this.activeCalls.get(callId);
    if (!call) return Promise.reject(new Error('Call not found'));

    const { domain, extension } = this.config;
    call.cseq++;
    const via = `SIP/2.0/UDP ${this.localIp}:${this.localPort};branch=${genBranch()};rport`;
    const toTag = call.toTag ? `;tag=${call.toTag}` : '';

    const msg = buildSipRequest('REFER', call.inviteUri, {
      via,
      from: `"${this.config.callerIdName}" <sip:${extension}@${domain}>;tag=${call.tag}`,
      to: `<${call.inviteUri}>${toTag}`,
      callId,
      cseq: call.cseq,
      contact: `<sip:${extension}@${this.localIp}:${this.localPort}>`,
      extraHeaders: {
        'Refer-To': `<sip:${targetExt}@${domain}>`,
        'Referred-By': `<sip:${extension}@${domain}>`,
      },
    });

    return new Promise((resolve, reject) => {
      call.referResolve = resolve;
      call.referReject = reject;
      call.referTimer = setTimeout(() => {
        reject(new Error('REFER timeout'));
      }, 15_000);
      this.send(msg);
    });
  }

  handleReferResponse(res) {
    const callId = res.headers['call-id'];
    const call = this.activeCalls.get(callId);
    if (!call || !call.referResolve) return;

    // Auth challenge for REFER
    if (res.statusCode === 401 || res.statusCode === 407) {
      // For simplicity, just fail and try next extension
      clearTimeout(call.referTimer);
      call.referReject(new Error(`REFER auth required: ${res.statusCode}`));
      call.referResolve = null;
      call.referReject = null;
      return;
    }

    if (res.statusCode === 202 || res.statusCode === 200) {
      clearTimeout(call.referTimer);
      call.referResolve();
      call.referResolve = null;
      call.referReject = null;
      return;
    }

    if (res.statusCode >= 300) {
      clearTimeout(call.referTimer);
      call.referReject(new Error(`REFER failed: ${res.statusCode}`));
      call.referResolve = null;
      call.referReject = null;
    }
  }

  // ─── CANCEL / BYE ───

  cancelCall(callId) {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    const { domain, extension } = this.config;
    const via = `SIP/2.0/UDP ${this.localIp}:${this.localPort};branch=${genBranch()};rport`;
    const toTag = call.toTag ? `;tag=${call.toTag}` : '';

    const msg = buildSipRequest('CANCEL', call.inviteUri, {
      via,
      from: `"${this.config.callerIdName}" <sip:${extension}@${domain}>;tag=${call.tag}`,
      to: `<${call.inviteUri}>${toTag}`,
      callId,
      cseq: call.cseq, // same CSeq as INVITE
    });

    this.send(msg);
    call.state = 'cancelled';
    this.activeCalls.delete(callId);
    logger.info(`SIP: CANCEL ${call.visitorPhone}`);
  }

  sendBye(callId) {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    const { domain, extension } = this.config;
    call.cseq++;
    const via = `SIP/2.0/UDP ${this.localIp}:${this.localPort};branch=${genBranch()};rport`;
    const toTag = call.toTag ? `;tag=${call.toTag}` : '';

    const msg = buildSipRequest('BYE', call.inviteUri, {
      via,
      from: `"${this.config.callerIdName}" <sip:${extension}@${domain}>;tag=${call.tag}`,
      to: `<${call.inviteUri}>${toTag}`,
      callId,
      cseq: call.cseq,
    });

    this.send(msg);
    this.activeCalls.delete(callId);
    logger.info(`SIP: BYE ${call.visitorPhone}`);
  }

  // ─── Incoming message router ───

  handleMessage(buf, rinfo) {
    const msg = parseSipMessage(buf);
    if (!msg) return;

    if (msg.type === 'response') {
      const cseqHdr = msg.headers['cseq'] || '';
      const method = cseqHdr.split(/\s+/)[1];

      if (method === 'REGISTER') return this.handleRegisterResponse(msg);
      if (method === 'INVITE') return this.handleInviteResponse(msg);
      if (method === 'REFER') return this.handleReferResponse(msg);
      // BYE/CANCEL responses — just log
      if (method === 'BYE' || method === 'CANCEL') return;

      return;
    }

    if (msg.type === 'request') {
      // Handle incoming requests (BYE from PBX, NOTIFY for REFER status, OPTIONS keepalive)
      if (msg.method === 'BYE') {
        // PBX is terminating our call leg (after successful transfer)
        this.send(buildSipResponse(200, 'OK', msg));
        const callId = msg.headers['call-id'];
        const call = this.activeCalls.get(callId);
        if (call) {
          this.activeCalls.delete(callId);
          logger.info(`SIP: BYE received — call ${callId} ended`);
        }
        return;
      }

      if (msg.method === 'NOTIFY') {
        // REFER status notifications
        this.send(buildSipResponse(200, 'OK', msg));
        return;
      }

      if (msg.method === 'OPTIONS') {
        // Keepalive — respond 200
        this.send(buildSipResponse(200, 'OK', msg));
        return;
      }

      // Other requests — 405
      this.send(buildSipResponse(405, 'Method Not Allowed', msg));
    }
  }

  // ─── Public API ───

  /**
   * Click2Call: call visitor and transfer to agent extensions.
   * @param {string} visitorPhone - Visitor's phone number
   * @param {string} [businessLine] - For logging/CallerID context
   * @returns {Promise<{success: boolean, transferredTo: string}>}
   */
  async click2call(visitorPhone, businessLine) {
    if (!this.registered) {
      throw new Error('SIP not registered — Click2Call unavailable');
    }

    logger.info(`SIP: Click2Call — calling ${visitorPhone} (BU: ${businessLine || 'general'})`);

    try {
      const result = await this.originate(visitorPhone);
      logger.info(`SIP: Click2Call success — ${visitorPhone} → ext ${result.transferredTo}`);
      return result;
    } catch (e) {
      logger.error(`SIP: Click2Call failed — ${visitorPhone}: ${e.message}`);
      throw e;
    }
  }

  destroy() {
    if (this.registerTimer) clearInterval(this.registerTimer);
    for (const callId of this.activeCalls.keys()) {
      this.sendBye(callId);
    }
    if (this.socket) this.socket.close();
    this.registered = false;
  }
}

// ─── Tag extraction helper ───
function extractTag(toHeader) {
  if (!toHeader) return null;
  const m = toHeader.match(/tag=([^\s;,]+)/);
  return m ? m[1] : null;
}

// ─── Singleton ───
const sipClient = new SipClick2Call();

async function initSipClick2Call() {
  try {
    await sipClient.init();
  } catch (e) {
    logger.error('SIP: Init failed:', e.message);
  }
}

module.exports = { sipClient, initSipClick2Call };
