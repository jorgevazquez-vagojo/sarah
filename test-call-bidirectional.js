#!/usr/bin/env node
/**
 * Bidirectional SIP Call Agent — calls a number and has a real conversation.
 *
 * Flow: Call → TTS greeting → listen RTP → detect silence → STT →
 *       AI response → TTS → send RTP → repeat
 *
 * AI providers (with automatic fallback):
 *   STT chain:          Gemini → OpenAI Whisper → error
 *   Conversation chain: Claude → Gemini → OpenAI → error
 */

const dgram = require('dgram');
const crypto = require('crypto');
const os = require('os');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const SIP_CONFIG = {
  domain: 'cloudpbx1584.vozelia.com',
  port: 5060,
  extension: '108',
  password: '0H1Yq88OTjLBlcL',
  aiProvider: 'claude', // 'claude' | 'gemini' | 'openai'
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  openaiKey: process.env.OPENAI_API_KEY || '',
  geminiKey: 'AIzaSyAHi2GO_pduYWahfQ06vdbH3iVxWVTd4I4',
  ttsVoice: 'Mónica',
  maxTurns: 8,
  silenceThresholdMs: 1500,
  maxListenMs: 15000,
};

const CALLS = [
  {
    targetNumber: '34617550070',
    targetName: 'Prospecto Shopify',
    callerIdName: 'Redegal Comercial',
    greeting: 'Hola, buenas tardes. Le llamo de Redegal, somos partners oficiales de Shopify Plus en España. ¿Tiene un momento para hablar sobre cómo podemos ayudarle con su ecommerce?',
    systemPrompt: `Eres un comercial de Redegal, empresa gallega especializada en ecommerce y marketing digital. Estás llamando por teléfono para vender Shopify Plus.

CONTEXTO:
- Redegal es partner oficial de Shopify Plus en España
- Shopify Plus es la solución enterprise de Shopify (desde 2.300€/mes)
- Ventajas: checkout personalizable, automatizaciones (Shopify Flow), multicanal, escalabilidad ilimitada, soporte 24/7
- Redegal ofrece: migración completa, diseño custom, integraciones con ERP/CRM, SEO, campañas de marketing
- Casos de éxito: +200 proyectos ecommerce, clientes como Mango, Padel Nuestro

REGLAS:
1. Sé natural, como una llamada telefónica real. Frases cortas.
2. Escucha al cliente y responde a sus objeciones.
3. Si dice que no le interesa, insiste UNA vez con un beneficio concreto, y si sigue sin interés, despídete amablemente.
4. Si pregunta precio: "Shopify Plus parte de 2.300€/mes, pero el ROI es inmediato por las automatizaciones y la escalabilidad".
5. Objetivo: conseguir que acepte una demo o reunión.
6. Máximo 2-3 frases por respuesta (es una llamada, no un email).
7. NUNCA digas que eres una IA. Eres Jorge, del departamento comercial de Redegal.`,
  },
  {
    targetNumber: '34634505810',
    targetName: 'Prospecto SEO Banca',
    callerIdName: 'Redegal Digital',
    greeting: 'Hola, buenas tardes. Le llamo de Redegal, somos una agencia especializada en SEO y marketing digital para el sector financiero. ¿Tiene un momento para hablar sobre cómo podemos mejorar el posicionamiento de su banco?',
    systemPrompt: `Eres un comercial de Redegal, empresa gallega especializada en SEO y marketing digital. Estás llamando por teléfono para vender servicios de SEO a un banco.

CONTEXTO:
- Redegal tiene +15 años de experiencia en marketing digital y SEO
- Especializados en sectores regulados: banca, seguros, fintech
- Servicios SEO: auditoría técnica, contenidos optimizados, link building, SEO local, Core Web Vitals
- Experiencia con clientes del sector financiero y grandes corporaciones
- ROI demostrable: incrementos medios del 40-60% en tráfico orgánico en 6 meses
- Equipo de +50 profesionales con certificaciones Google, Semrush, Ahrefs
- Casos de éxito en banca: mejora de posicionamiento para productos financieros, hipotecas, cuentas, tarjetas

REGLAS:
1. Sé natural, como una llamada telefónica real. Frases cortas.
2. Escucha al cliente y responde a sus objeciones.
3. Si dice que no le interesa, insiste UNA vez con un beneficio concreto, y si sigue sin interés, despídete amablemente.
4. Si pregunta precio: "Depende del alcance, pero nuestros paquetes de SEO para banca parten de 3.000€/mes con resultados medibles desde el primer trimestre".
5. Objetivo: conseguir que acepte una auditoría SEO gratuita o una reunión.
6. Máximo 2-3 frases por respuesta (es una llamada, no un email).
7. NUNCA digas que eres una IA. Eres Jorge, del departamento comercial de Redegal.`,
  },
  {
    targetNumber: '34627915810',
    targetName: 'Prospecto Shopify 2',
    callerIdName: 'Redegal Comercial',
    greeting: 'Hola, buenas tardes. Soy Jorge de Redegal. Le llamo porque somos partners de Shopify Plus y creemos que podría interesarle nuestra solución de ecommerce. ¿Tiene un minutito?',
    systemPrompt: `Eres un comercial de Redegal, empresa gallega especializada en ecommerce y marketing digital. Estás llamando por teléfono para vender Shopify Plus.

CONTEXTO:
- Redegal es partner oficial de Shopify Plus en España
- Shopify Plus es la solución enterprise de Shopify (desde 2.300€/mes)
- Ventajas: checkout personalizable, automatizaciones (Shopify Flow), multicanal, escalabilidad ilimitada, soporte 24/7
- Redegal ofrece: migración completa, diseño custom, integraciones con ERP/CRM, SEO, campañas de marketing
- Casos de éxito: +200 proyectos ecommerce, clientes como Mango, Padel Nuestro

REGLAS:
1. Sé natural, como una llamada telefónica real. Frases cortas.
2. Escucha al cliente y responde a sus objeciones.
3. Si dice que no le interesa, insiste UNA vez con un beneficio concreto, y si sigue sin interés, despídete amablemente.
4. Si pregunta precio: "Shopify Plus parte de 2.300€/mes, pero el ROI es inmediato por las automatizaciones y la escalabilidad".
5. Objetivo: conseguir que acepte una demo o reunión.
6. Máximo 2-3 frases por respuesta (es una llamada, no un email).
7. NUNCA digas que eres una IA. Eres Jorge, del departamento comercial de Redegal.`,
  },
  {
    targetNumber: '34617550070',
    targetName: 'Prospecto Boostic',
    callerIdName: 'Boostic Cloud',
    greeting: 'Hola, buenas tardes. Soy Jorge de Boostic Cloud, la plataforma de crecimiento digital de Redegal. ¿Tiene un momento para hablar sobre cómo podemos impulsar su posicionamiento online?',
    systemPrompt: `Eres un comercial de Boostic Cloud, la plataforma de SEO y growth de Redegal. Estás llamando por teléfono para vender Boostic.

CONTEXTO:
- Boostic Cloud es la plataforma SaaS de SEO y crecimiento orgánico de Redegal
- Funcionalidades: monitorización de rankings, auditorías SEO automáticas, análisis de competencia, detección de oportunidades de contenido, tracking de Core Web Vitals
- Integraciones con Google Search Console, Analytics, Semrush, Ahrefs
- Dashboard intuitivo con alertas y recomendaciones automatizadas
- Ideal para equipos de marketing que quieren escalar su SEO sin depender de agencia
- Precio: desde 299€/mes para hasta 5 dominios, planes enterprise personalizados
- +200 clientes activos, incluyendo grandes retailers y marcas españolas
- Soporte dedicado y onboarding personalizado

REGLAS:
1. Sé natural, como una llamada telefónica real. Frases cortas.
2. Escucha al cliente y responde a sus objeciones.
3. Si dice que no le interesa, insiste UNA vez con un beneficio concreto, y si sigue sin interés, despídete amablemente.
4. Si pregunta precio: "Boostic parte de 299€/mes y el setup es gratuito. Os hacemos un onboarding completo".
5. Objetivo: conseguir que acepte una demo gratuita de Boostic.
6. Máximo 2-3 frases por respuesta (es una llamada, no un email).
7. NUNCA digas que eres una IA. Eres Jorge, del equipo comercial de Boostic Cloud.`,
  },
];

// Active call config (set per call)
let CONFIG = { ...SIP_CONFIG, ...CALLS[0] };

// ─── SIP helpers (same as before) ───
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

function log(icon, msg) {
  const time = new Date().toISOString().substr(11, 12);
  console.log(`[${time}] ${icon}  ${msg}`);
}

// ─── STUN: Discover public IP:port via Binding Request ───
function stunDiscover(socket, stunHost = 'stun.l.google.com', stunPort = 19302) {
  return new Promise((resolve, reject) => {
    const MAGIC_COOKIE = 0x2112A442;
    const txId = crypto.randomBytes(12);

    // Build STUN Binding Request (20 bytes header, 0 body)
    const req = Buffer.alloc(20);
    req.writeUInt16BE(0x0001, 0);  // Message Type: Binding Request
    req.writeUInt16BE(0x0000, 2);  // Message Length: 0
    req.writeUInt32BE(MAGIC_COOKIE, 4);
    txId.copy(req, 8);

    const timer = setTimeout(() => {
      socket.removeListener('message', handler);
      reject(new Error('STUN timeout'));
    }, 5000);

    function handler(msg, rinfo) {
      if (msg.length < 20) return;
      // Check it's a STUN Binding Response (0x0101) with matching magic cookie
      const msgType = msg.readUInt16BE(0);
      const cookie = msg.readUInt32BE(4);
      if (msgType !== 0x0101 || cookie !== MAGIC_COOKIE) return;
      // Check transaction ID matches
      if (!msg.subarray(8, 20).equals(txId)) return;

      clearTimeout(timer);
      socket.removeListener('message', handler);

      // Parse attributes
      const msgLen = msg.readUInt16BE(2);
      let offset = 20;
      const end = 20 + msgLen;

      while (offset + 4 <= end) {
        const attrType = msg.readUInt16BE(offset);
        const attrLen = msg.readUInt16BE(offset + 2);
        const attrStart = offset + 4;

        // XOR-MAPPED-ADDRESS (0x0020)
        if (attrType === 0x0020 && attrLen >= 8) {
          const family = msg[attrStart + 1];
          if (family === 0x01) { // IPv4
            const xPort = msg.readUInt16BE(attrStart + 2) ^ (MAGIC_COOKIE >>> 16);
            const xIp = msg.readUInt32BE(attrStart + 4) ^ MAGIC_COOKIE;
            const ip = `${(xIp >>> 24) & 0xFF}.${(xIp >>> 16) & 0xFF}.${(xIp >>> 8) & 0xFF}.${xIp & 0xFF}`;
            resolve({ ip, port: xPort });
            return;
          }
        }

        // MAPPED-ADDRESS (0x0001) fallback
        if (attrType === 0x0001 && attrLen >= 8) {
          const family = msg[attrStart + 1];
          if (family === 0x01) {
            const port = msg.readUInt16BE(attrStart + 2);
            const ip4 = msg.readUInt32BE(attrStart + 4);
            const ip = `${(ip4 >>> 24) & 0xFF}.${(ip4 >>> 16) & 0xFF}.${(ip4 >>> 8) & 0xFF}.${ip4 & 0xFF}`;
            resolve({ ip, port });
            return;
          }
        }

        // Next attribute (padded to 4-byte boundary)
        offset = attrStart + Math.ceil(attrLen / 4) * 4;
      }

      reject(new Error('STUN response missing MAPPED-ADDRESS'));
    }

    socket.on('message', handler);
    socket.send(req, 0, req.length, stunPort, stunHost);
  });
}

// ─── u-law decode (for incoming RTP) ───
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

// ─── TTS generation (Microsoft Edge TTS — Elvira Neural) ───
function generateTts(text) {
  const tmpDir = '/tmp';
  const mp3File = path.join(tmpDir, `tts-${Date.now()}.mp3`);
  const ulawFile = path.join(tmpDir, `tts-${Date.now()}.wav`);

  // Escape quotes for shell
  const escaped = text.replace(/'/g, "'\\''");
  // Use Microsoft Edge TTS (Elvira = Spanish Spain female)
  execSync(`python3 -c "
import asyncio, edge_tts
async def main():
    comm = edge_tts.Communicate('${escaped}', 'es-ES-ElviraNeural', rate='+5%')
    await comm.save('${mp3File}')
asyncio.run(main())
"`, { timeout: 20000 });

  // Convert MP3 → u-law WAV 8kHz mono
  execSync(`afconvert -f WAVE -d ulaw@8000 -c 1 "${mp3File}" "${ulawFile}"`, { timeout: 10000 });

  const wavData = fs.readFileSync(ulawFile);
  const audioData = wavData.subarray(44); // Skip WAV header

  try { fs.unlinkSync(mp3File); } catch {}
  try { fs.unlinkSync(ulawFile); } catch {}

  return audioData;
}

// ─── Shared RTP state (keeps seq/timestamp continuous across all sends) ───
const rtpState = { seq: 0, timestamp: 0 };

// ─── Send RTP audio (returns promise) ───
function sendRtpAudio(rtpSocket, remoteIp, remotePort, audioData, ssrc) {
  return new Promise((resolve) => {
    const PACKET_SIZE = 160;
    let offset = 0;
    let isFirst = rtpState.seq === 0;

    // Prepend 300ms silence
    const silence = Buffer.alloc(2400, 0xFF);
    const fullAudio = Buffer.concat([silence, audioData]);

    const interval = setInterval(() => {
      if (offset >= fullAudio.length) {
        clearInterval(interval);
        resolve();
        return;
      }
      const chunk = fullAudio.subarray(offset, offset + PACKET_SIZE);
      offset += PACKET_SIZE;

      const header = Buffer.alloc(12);
      header[0] = 0x80;
      header[1] = 0x00;
      if (isFirst) { header[1] |= 0x80; isFirst = false; }
      header.writeUInt16BE(rtpState.seq & 0xFFFF, 2);
      header.writeUInt32BE(rtpState.timestamp & 0xFFFFFFFF, 4);
      header.writeUInt32BE(ssrc, 8);

      rtpSocket.send(Buffer.concat([header, chunk]), 0, 12 + chunk.length, remotePort, remoteIp);
      rtpState.seq++;
      rtpState.timestamp += PACKET_SIZE;
    }, 20);
  });
}

// ─── Send silence RTP to keep NAT open and latch PBX ───
function sendSilenceRtp(rtpSocket, remoteIp, remotePort, ssrc, durationMs) {
  return new Promise((resolve) => {
    const PACKET_SIZE = 160;
    const totalPackets = Math.ceil(durationMs / 20);
    let sent = 0;
    let isFirst = rtpState.seq === 0;

    const interval = setInterval(() => {
      if (sent >= totalPackets) {
        clearInterval(interval);
        resolve();
        return;
      }
      const silence = Buffer.alloc(PACKET_SIZE, 0xFF); // u-law silence
      const header = Buffer.alloc(12);
      header[0] = 0x80;
      header[1] = 0x00;
      if (isFirst) { header[1] |= 0x80; isFirst = false; }
      header.writeUInt16BE(rtpState.seq & 0xFFFF, 2);
      header.writeUInt32BE(rtpState.timestamp & 0xFFFFFFFF, 4);
      header.writeUInt32BE(ssrc, 8);

      rtpSocket.send(Buffer.concat([header, silence]), 0, 12 + PACKET_SIZE, remotePort, remoteIp);
      rtpState.seq++;
      rtpState.timestamp += PACKET_SIZE;
      sent++;
    }, 20);
  });
}

// ─── Listen for speech (collect RTP, detect silence) ───
// Also sends comfort noise to keep NAT open
function listenForSpeech(rtpSocket, remoteIp, remotePort, ssrc, hungUpRef) {
  return new Promise((resolve) => {
    const audioChunks = [];
    let lastVoiceTime = Date.now();
    let speechStarted = false;
    const startTime = Date.now();
    let packetCount = 0;
    let maxEnergy = 0;
    let resolved = false;

    const ENERGY_THRESHOLD = 150;

    function cleanup() {
      if (resolved) return;
      resolved = true;
      clearInterval(cnInterval);
      clearInterval(watchdog);
      rtpSocket.removeListener('message', handler);
    }

    // Send comfort noise every 20ms to keep NAT pinhole open
    const cnInterval = setInterval(() => {
      if (resolved) return;
      const silence = Buffer.alloc(160, 0xFF);
      const header = Buffer.alloc(12);
      header[0] = 0x80;
      header[1] = 0x00;
      header.writeUInt16BE(rtpState.seq & 0xFFFF, 2);
      header.writeUInt32BE(rtpState.timestamp & 0xFFFFFFFF, 4);
      header.writeUInt32BE(ssrc, 8);
      rtpSocket.send(Buffer.concat([header, silence]), 0, 172, remotePort, remoteIp);
      rtpState.seq++;
      rtpState.timestamp += 160;
    }, 20);

    // Watchdog: check hangup and timeout every 500ms (independent of RTP)
    const watchdog = setInterval(() => {
      if (resolved) return;
      // Remote hung up
      if (hungUpRef && hungUpRef.value) {
        cleanup();
        log('📴', 'Listen interrumpido: remoto colgo');
        resolve(audioChunks.length > 0 ? Buffer.concat(audioChunks) : null);
        return;
      }
      // Timeout
      const elapsed = Date.now() - startTime;
      if (elapsed > CONFIG.maxListenMs) {
        cleanup();
        if (audioChunks.length > 0) {
          log('🎧', `Timeout: ${(audioChunks.length * 20 / 1000).toFixed(1)}s audio (maxE=${maxEnergy.toFixed(0)})`);
          resolve(Buffer.concat(audioChunks));
        } else {
          log('🎧', `No voz (${packetCount} pkts, maxE=${maxEnergy.toFixed(0)})`);
          resolve(null);
        }
      }
    }, 500);

    function handler(msg, rinfo) {
      if (resolved) return;
      if (msg.length < 12) return;
      if (rinfo && rinfo.address !== remoteIp) return;

      const payload = msg.subarray(12);
      packetCount++;

      let energy = 0;
      for (let i = 0; i < payload.length; i++) {
        const sample = Math.abs(ULAW_DECODE[payload[i]]);
        energy += sample;
      }
      energy /= payload.length;
      if (energy > maxEnergy) maxEnergy = energy;

      if (packetCount <= 3) {
        log('🔍', `RTP pkt #${packetCount} from ${rinfo?.address}:${rinfo?.port} len=${msg.length} energy=${energy.toFixed(0)}`);
      }

      if (energy > ENERGY_THRESHOLD) {
        if (!speechStarted) log('🎤', `Voz detectada (energy=${energy.toFixed(0)})`);
        speechStarted = true;
        lastVoiceTime = Date.now();
      }

      if (speechStarted) {
        audioChunks.push(Buffer.from(payload));
      }

      const silenceMs = Date.now() - lastVoiceTime;
      if (speechStarted && silenceMs > CONFIG.silenceThresholdMs) {
        cleanup();
        log('🎧', `Escuchado: ${(audioChunks.length * 20 / 1000).toFixed(1)}s audio (${packetCount} pkts, maxE=${maxEnergy.toFixed(0)})`);
        resolve(Buffer.concat(audioChunks));
      }
    }

    rtpSocket.on('message', handler);
  });
}

// ─── Convert u-law buffer to WAV for Gemini ───
function ulawToWav(ulawData) {
  // Convert u-law to 16-bit PCM
  const pcmData = Buffer.alloc(ulawData.length * 2);
  for (let i = 0; i < ulawData.length; i++) {
    pcmData.writeInt16LE(ULAW_DECODE[ulawData[i]], i * 2);
  }

  // Build WAV header
  const wavHeader = Buffer.alloc(44);
  const dataSize = pcmData.length;
  const fileSize = 36 + dataSize;

  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(fileSize, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16); // fmt chunk size
  wavHeader.writeUInt16LE(1, 20);  // PCM format
  wavHeader.writeUInt16LE(1, 22);  // mono
  wavHeader.writeUInt32LE(8000, 24); // sample rate
  wavHeader.writeUInt32LE(16000, 28); // byte rate
  wavHeader.writeUInt16LE(2, 32);  // block align
  wavHeader.writeUInt16LE(16, 34); // bits per sample
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(dataSize, 40);

  return Buffer.concat([wavHeader, pcmData]);
}

// ═══════════════════════════════════════════════════
// MULTI-PROVIDER AI SYSTEM
// STT chain:          Gemini → OpenAI Whisper → error
// Conversation chain: Claude → Gemini → OpenAI → error
// ═══════════════════════════════════════════════════

// ─── Gemini: single request ───
function geminiRequestOnce(model, body) {
  return new Promise((resolve, reject) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${SIP_CONFIG.geminiKey}`;
    const parsed = new URL(url);

    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            const err = new Error(`Gemini ${json.error.code}: ${json.error.message?.substring(0, 100)}`);
            err.code = json.error.code;
            reject(err);
            return;
          }
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
          resolve(text.trim());
        } catch (e) {
          reject(new Error(`Gemini parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Gemini timeout')); });
    req.write(body);
    req.end();
  });
}

// ─── Claude (Anthropic): single request ───
function claudeRequestOnce(messages, { maxTokens = 150, temperature = 0.7 } = {}) {
  return new Promise((resolve, reject) => {
    if (!SIP_CONFIG.anthropicKey) {
      reject(new Error('Claude: ANTHROPIC_API_KEY not configured'));
      return;
    }
    const body = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages,
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SIP_CONFIG.anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            const err = new Error(`Claude ${json.error.type}: ${json.error.message?.substring(0, 100)}`);
            err.code = res.statusCode;
            reject(err);
            return;
          }
          const text = json.content?.[0]?.text || '';
          resolve(text.trim());
        } catch (e) {
          reject(new Error(`Claude parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Claude timeout')); });
    req.write(body);
    req.end();
  });
}

// ─── OpenAI: chat completion (single request) ───
function openaiChatOnce(messages, { maxTokens = 150, temperature = 0.7 } = {}) {
  return new Promise((resolve, reject) => {
    if (!SIP_CONFIG.openaiKey) {
      reject(new Error('OpenAI: OPENAI_API_KEY not configured'));
      return;
    }
    const body = JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: maxTokens,
      temperature,
      messages,
    });

    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SIP_CONFIG.openaiKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            const err = new Error(`OpenAI ${json.error.type}: ${json.error.message?.substring(0, 100)}`);
            err.code = res.statusCode;
            reject(err);
            return;
          }
          const text = json.choices?.[0]?.message?.content || '';
          resolve(text.trim());
        } catch (e) {
          reject(new Error(`OpenAI parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('OpenAI timeout')); });
    req.write(body);
    req.end();
  });
}

// ─── OpenAI Whisper: STT (multipart form data) ───
function openaiWhisperOnce(wavBuffer) {
  return new Promise((resolve, reject) => {
    if (!SIP_CONFIG.openaiKey) {
      reject(new Error('OpenAI Whisper: OPENAI_API_KEY not configured'));
      return;
    }
    const boundary = '----FormBoundary' + crypto.randomBytes(8).toString('hex');
    const parts = [];

    // model field
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="model"\r\n\r\n` +
      `whisper-1\r\n`
    );
    // language field
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="language"\r\n\r\n` +
      `es\r\n`
    );
    // file field
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n` +
      `Content-Type: audio/wav\r\n\r\n`
    );

    const header = Buffer.from(parts.join(''));
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const bodyBuffer = Buffer.concat([header, wavBuffer, footer]);

    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/audio/transcriptions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SIP_CONFIG.openaiKey}`,
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
          reject(new Error(`Whisper parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Whisper timeout')); });
    req.write(bodyBuffer);
    req.end();
  });
}

// ─── Retryable check: should we fallback on this error? ───
function isRetryableError(err) {
  const code = err.code;
  if (code === 429 || code === 500 || code === 502 || code === 503) return true;
  if (err.message && (err.message.includes('timeout') || err.message.includes('not configured'))) return true;
  return false;
}

// ─── Unified STT: Gemini → OpenAI Whisper → error ───
async function transcribeAudio(wavBase64, wavBuffer) {
  const sttChain = ['gemini', 'openai'];

  for (let i = 0; i < sttChain.length; i++) {
    const provider = sttChain[i];
    try {
      if (provider === 'gemini') {
        log('🔤', `STT [gemini]...`);
        const body = JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: 'audio/wav', data: wavBase64 } },
              { text: 'Transcribe this audio exactly. Only output the transcription, nothing else. If you cannot understand it, output "[inaudible]". The audio is in Spanish.' }
            ]
          }],
          generationConfig: { temperature: 0, maxOutputTokens: 200 }
        });
        return await geminiRequestOnce('gemini-2.5-flash', body);
      }

      if (provider === 'openai') {
        log('🔤', `STT [openai whisper]...`);
        return await openaiWhisperOnce(wavBuffer);
      }
    } catch (err) {
      log('⚠️', `STT [${provider}] failed: ${err.message}`);
      if (i < sttChain.length - 1 && isRetryableError(err)) {
        log('🔄', `STT fallback → ${sttChain[i + 1]}`);
        continue;
      }
      throw err;
    }
  }
  throw new Error('All STT providers failed');
}

// ─── Unified conversation AI: Claude → Gemini → OpenAI → error ───
async function callAI(prompt, { systemPrompt = '', conversationHistory = [], maxTokens = 150, temperature = 0.7 } = {}) {
  const convChain = ['claude', 'gemini', 'openai'];
  // Put configured provider first in chain
  const preferred = SIP_CONFIG.aiProvider || 'claude';
  const idx = convChain.indexOf(preferred);
  if (idx > 0) {
    convChain.splice(idx, 1);
    convChain.unshift(preferred);
  }

  for (let i = 0; i < convChain.length; i++) {
    const provider = convChain[i];
    try {
      if (provider === 'claude') {
        log('🤖', `AI [claude]...`);
        const messages = [];
        // System prompt as first user message + assistant ack (Claude API pattern)
        if (systemPrompt) {
          messages.push({ role: 'user', content: systemPrompt });
          messages.push({ role: 'assistant', content: 'Entendido. Soy Jorge del departamento comercial de Redegal. Estoy listo para la llamada.' });
        }
        for (const turn of conversationHistory) {
          messages.push({ role: 'user', content: `[El cliente dice]: ${turn.user}` });
          if (turn.assistant) {
            messages.push({ role: 'assistant', content: turn.assistant });
          }
        }
        messages.push({ role: 'user', content: `[El cliente dice]: ${prompt}` });
        return await claudeRequestOnce(messages, { maxTokens, temperature });
      }

      if (provider === 'gemini') {
        log('🤖', `AI [gemini]...`);
        const geminiMessages = [];
        if (systemPrompt) {
          geminiMessages.push({ role: 'user', parts: [{ text: systemPrompt }] });
          geminiMessages.push({ role: 'model', parts: [{ text: 'Entendido. Soy Jorge del departamento comercial de Redegal. Estoy listo para la llamada.' }] });
        }
        for (const turn of conversationHistory) {
          geminiMessages.push({ role: 'user', parts: [{ text: `[El cliente dice]: ${turn.user}` }] });
          if (turn.assistant) {
            geminiMessages.push({ role: 'model', parts: [{ text: turn.assistant }] });
          }
        }
        geminiMessages.push({ role: 'user', parts: [{ text: `[El cliente dice]: ${prompt}` }] });
        const body = JSON.stringify({
          contents: geminiMessages,
          generationConfig: { temperature, maxOutputTokens: maxTokens }
        });
        return await geminiRequestOnce('gemini-2.5-flash', body);
      }

      if (provider === 'openai') {
        log('🤖', `AI [openai]...`);
        const openaiMessages = [];
        if (systemPrompt) {
          openaiMessages.push({ role: 'system', content: systemPrompt });
        }
        for (const turn of conversationHistory) {
          openaiMessages.push({ role: 'user', content: `[El cliente dice]: ${turn.user}` });
          if (turn.assistant) {
            openaiMessages.push({ role: 'assistant', content: turn.assistant });
          }
        }
        openaiMessages.push({ role: 'user', content: `[El cliente dice]: ${prompt}` });
        return await openaiChatOnce(openaiMessages, { maxTokens, temperature });
      }
    } catch (err) {
      log('⚠️', `AI [${provider}] failed: ${err.message}`);
      if (i < convChain.length - 1 && isRetryableError(err)) {
        log('🔄', `AI fallback → ${convChain[i + 1]}`);
        continue;
      }
      throw err;
    }
  }
  throw new Error('All AI providers failed');
}

// ─── Speech-to-Text (uses transcribeAudio with fallback chain) ───
async function speechToText(audioBuffer) {
  const wavBuffer = ulawToWav(audioBuffer);
  const audioBase64 = wavBuffer.toString('base64');
  return transcribeAudio(audioBase64, wavBuffer);
}

// ─── Generate sales response (uses callAI with fallback chain) ───
async function generateResponse(userText, conversationHistory) {
  return callAI(userText, {
    systemPrompt: CONFIG.systemPrompt,
    conversationHistory,
    maxTokens: 150,
    temperature: 0.7,
  });
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════

async function makeCall(callConfig) {
  CONFIG = { ...SIP_CONFIG, ...callConfig };
  rtpState.seq = 0;
  rtpState.timestamp = 0;
  const localIp = getLocalIp();
  const sipSocket = dgram.createSocket('udp4');
  const rtpSocket = dgram.createSocket('udp4');

  await new Promise((r) => sipSocket.bind(0, r));
  const sipPort = sipSocket.address().port;
  await new Promise((r) => rtpSocket.bind(0, r));
  const rtpPort = rtpSocket.address().port;

  // ─── STUN: discover public IP:port for RTP ───
  log('🌐', 'STUN discovery...');
  let publicIp, publicRtpPort;
  try {
    const stun = await stunDiscover(rtpSocket);
    publicIp = stun.ip;
    publicRtpPort = stun.port;
    log('🌐', `STUN OK: ${publicIp}:${publicRtpPort} (local: ${localIp}:${rtpPort})`);
  } catch (e) {
    log('⚠️', `STUN failed (${e.message}), using local IP`);
    publicIp = localIp;
    publicRtpPort = rtpPort;
  }

  const ssrc = crypto.randomBytes(4).readUInt32BE(0);
  const hungUpRef = { value: false };

  log('📞', `Llamada bidireccional a +${CONFIG.targetNumber}`);
  log('🔧', `PBX: ${CONFIG.domain} | Ext: ${CONFIG.extension}`);
  log('🔧', `SIP: ${sipPort}, RTP: ${rtpPort} → public ${publicIp}:${publicRtpPort}`);

  function sendSip(msg) {
    sipSocket.send(Buffer.from(msg), 0, Buffer.byteLength(msg), CONFIG.port, CONFIG.domain);
  }

  function waitForSipResponse(timeoutMs = 5000, skipCodes = [100], filterCallId = null) {
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
        if (filterCallId && parsed.headers['call-id'] !== filterCallId) return;
        if (skipCodes.includes(parsed.statusCode)) return;
        clearTimeout(timer);
        sipSocket.removeListener('message', handler);
        resolve(parsed);
      }
      sipSocket.on('message', handler);
    });
  }

  // ─── REGISTER ───
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
    `Expires: 120\r\nMax-Forwards: 70\r\nUser-Agent: RedegalBot/1.0\r\nContent-Length: 0\r\n\r\n`
  );

  let res = await waitForSipResponse(5000);
  if (res.statusCode === 401 || res.statusCode === 407) {
    const authHeader = res.headers['www-authenticate'] || res.headers['proxy-authenticate'];
    const challenge = parseAuthChallenge(authHeader);
    const auth = buildDigestResponse('REGISTER', `sip:${CONFIG.domain}`, challenge, CONFIG.extension, CONFIG.password);
    const resP = waitForSipResponse(5000);
    sendSip(
      `REGISTER sip:${CONFIG.domain} SIP/2.0\r\n` +
      `Via: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\n` +
      `From: "${CONFIG.extension}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${regTag}\r\n` +
      `To: <sip:${CONFIG.extension}@${CONFIG.domain}>\r\n` +
      `Call-ID: ${regCallId}\r\n` +
      `CSeq: 2 REGISTER\r\n` +
      `Contact: <sip:${CONFIG.extension}@${localIp}:${sipPort}>\r\n` +
      `Authorization: ${auth}\r\n` +
      `Expires: 120\r\nMax-Forwards: 70\r\nUser-Agent: RedegalBot/1.0\r\nContent-Length: 0\r\n\r\n`
    );
    res = await resP;
  }
  if (res.statusCode !== 200) { log('❌', `REGISTER fail: ${res.statusCode}`); sipSocket.close(); rtpSocket.close(); return null; }
  log('✅', 'Registrado');

  // ─── INVITE ───
  const callId = genCallId();
  const callTag = genTag();
  let cseq = 1;
  const targetUri = `sip:${CONFIG.targetNumber}@${CONFIG.domain}`;

  const sdp = `v=0\r\no=RedegalBot ${Date.now()} ${Date.now()} IN IP4 ${publicIp}\r\ns=Sales Call\r\nc=IN IP4 ${publicIp}\r\nt=0 0\r\nm=audio ${publicRtpPort} RTP/AVP 0\r\na=rtpmap:0 PCMU/8000\r\na=ptime:20\r\na=sendrecv\r\n`;

  log('📞', `INVITE → +${CONFIG.targetNumber}...`);
  sendSip(
    `INVITE ${targetUri} SIP/2.0\r\n` +
    `Via: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\n` +
    `From: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${callTag}\r\n` +
    `To: <${targetUri}>\r\n` +
    `Call-ID: ${callId}\r\n` +
    `CSeq: ${cseq} INVITE\r\n` +
    `Contact: <sip:${CONFIG.extension}@${localIp}:${sipPort}>\r\n` +
    `Allow: INVITE, ACK, BYE, CANCEL\r\nMax-Forwards: 70\r\nUser-Agent: RedegalBot/1.0\r\n` +
    `Content-Type: application/sdp\r\nContent-Length: ${Buffer.byteLength(sdp)}\r\n\r\n${sdp}`
  );

  res = await waitForSipResponse(10000, [100], callId);

  // Auth
  if (res.statusCode === 407 || res.statusCode === 401) {
    const is407 = res.statusCode === 407;
    const authHdr = is407 ? res.headers['proxy-authenticate'] : res.headers['www-authenticate'];
    const challenge = parseAuthChallenge(authHdr);

    sendSip(`ACK ${targetUri} SIP/2.0\r\nVia: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\nFrom: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${callTag}\r\nTo: <${targetUri}>\r\nCall-ID: ${callId}\r\nCSeq: ${cseq} ACK\r\nMax-Forwards: 70\r\nContent-Length: 0\r\n\r\n`);

    cseq++;
    const auth = buildDigestResponse('INVITE', targetUri, challenge, CONFIG.extension, CONFIG.password);
    const hdrName = is407 ? 'Proxy-Authorization' : 'Authorization';

    const resP = waitForSipResponse(15000, [100], callId);
    sendSip(
      `INVITE ${targetUri} SIP/2.0\r\n` +
      `Via: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\n` +
      `From: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${callTag}\r\n` +
      `To: <${targetUri}>\r\n` +
      `Call-ID: ${callId}\r\n` +
      `CSeq: ${cseq} INVITE\r\n` +
      `Contact: <sip:${CONFIG.extension}@${localIp}:${sipPort}>\r\n` +
      `${hdrName}: ${auth}\r\n` +
      `Allow: INVITE, ACK, BYE, CANCEL\r\nMax-Forwards: 70\r\nUser-Agent: RedegalBot/1.0\r\n` +
      `Content-Type: application/sdp\r\nContent-Length: ${Buffer.byteLength(sdp)}\r\n\r\n${sdp}`
    );
    res = await resP;
  }

  // Ringing
  if (res.statusCode === 180 || res.statusCode === 183) {
    log('🔔', 'Sonando...');
    try {
      res = await waitForSipResponse(30000, [100], callId);
    } catch {
      log('⏰', 'No contesto');
      sendSip(`CANCEL ${targetUri} SIP/2.0\r\nVia: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\nFrom: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${callTag}\r\nTo: <${targetUri}>\r\nCall-ID: ${callId}\r\nCSeq: ${cseq} CANCEL\r\nMax-Forwards: 70\r\nContent-Length: 0\r\n\r\n`);
      sipSocket.close(); rtpSocket.close(); return null;
    }
  }

  if (res.statusCode !== 200) {
    log('❌', `Error: ${res.statusCode} ${res.statusText}`);
    sipSocket.close(); rtpSocket.close(); return null;
  }

  log('✅', 'CONTESTO! Iniciando conversacion...');

  // Parse remote RTP
  let remoteIp = localIp, remoteRtpPort = 0;
  if (res.body) {
    const cMatch = res.body.match(/c=IN IP4 (\S+)/);
    if (cMatch) remoteIp = cMatch[1];
    const mMatch = res.body.match(/m=audio (\d+)/);
    if (mMatch) remoteRtpPort = parseInt(mMatch[1]);
  }

  // ACK
  const toHeader = res.headers.to;
  sendSip(`ACK ${targetUri} SIP/2.0\r\nVia: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\nFrom: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${callTag}\r\nTo: ${toHeader}\r\nCall-ID: ${callId}\r\nCSeq: ${cseq} ACK\r\nMax-Forwards: 70\r\nContent-Length: 0\r\n\r\n`);

  log('🔊', `RTP ↔ ${remoteIp}:${remoteRtpPort}`);

  // ─── Send initial RTP silence to latch PBX media and open NAT ───
  log('🔗', 'Enviando RTP silence para abrir camino media (1s)...');
  await sendSilenceRtp(rtpSocket, remoteIp, remoteRtpPort, ssrc, 1000);
  log('🔗', 'Media path abierto');

  // ─── BYE detection: listen for remote hangup ───
  sipSocket.on('message', (msg) => {
    const parsed = parseSipMessage(msg);
    if (!parsed) return;
    // Respond to OPTIONS keepalive
    if (parsed.type === 'request' && parsed.method === 'OPTIONS') {
      sendSip(`SIP/2.0 200 OK\r\nVia: ${parsed.headers['via']}\r\nFrom: ${parsed.headers['from']}\r\nTo: ${parsed.headers['to']}\r\nCall-ID: ${parsed.headers['call-id']}\r\nCSeq: ${parsed.headers['cseq']}\r\nContent-Length: 0\r\n\r\n`);
      return;
    }
    // Detect BYE from remote
    if (parsed.type === 'request' && parsed.method === 'BYE') {
      log('📴', 'El remoto COLGO (BYE recibido)');
      // Send 200 OK to BYE
      sendSip(`SIP/2.0 200 OK\r\nVia: ${parsed.headers['via']}\r\nFrom: ${parsed.headers['from']}\r\nTo: ${parsed.headers['to']}\r\nCall-ID: ${parsed.headers['call-id']}\r\nCSeq: ${parsed.headers['cseq']}\r\nContent-Length: 0\r\n\r\n`);
      hungUpRef.value = true;
    }
  });

  // ─── CONVERSATION LOOP ───
  const history = [];

  // Send greeting
  log('🗣️', `[BOT] ${CONFIG.greeting}`);
  const greetingAudio = generateTts(CONFIG.greeting);
  await sendRtpAudio(rtpSocket, remoteIp, remoteRtpPort, greetingAudio, ssrc);

  for (let turn = 0; turn < CONFIG.maxTurns; turn++) {
    if (hungUpRef.value) { log('📴', 'Llamada terminada por el remoto'); break; }
    console.log(`\n─── Turno ${turn + 1}/${CONFIG.maxTurns} ───`);

    // Listen
    log('🎧', 'Escuchando...');
    const spokenAudio = await listenForSpeech(rtpSocket, remoteIp, remoteRtpPort, ssrc, hungUpRef);
    if (hungUpRef.value) { log('📴', 'Llamada terminada por el remoto'); break; }

    // Save first turn audio for debug
    if (turn === 0 && spokenAudio && spokenAudio.length > 0) {
      const debugWav = ulawToWav(spokenAudio);
      fs.writeFileSync('/tmp/debug-call-audio.wav', debugWav);
      log('💾', `Debug audio guardado: /tmp/debug-call-audio.wav (${spokenAudio.length} bytes u-law)`);
    }

    if (!spokenAudio || spokenAudio.length < 400) { // < 0.05s
      log('🤷', 'No se detecto voz suficiente');
      if (turn > 0) {
        // Ask if they're still there
        const nudge = '¿Sigue ahí? ¿Le interesaría que le contase más sobre nuestros servicios?';
        log('🗣️', `[BOT] ${nudge}`);
        const nudgeAudio = generateTts(nudge);
        await sendRtpAudio(rtpSocket, remoteIp, remoteRtpPort, nudgeAudio, ssrc);
        continue;
      }
      continue;
    }

    // STT
    log('📝', 'Transcribiendo...');
    let userText;
    try {
      userText = await speechToText(spokenAudio);
      log('👤', `[CLIENTE] "${userText}"`);
    } catch (e) {
      log('⚠️', `STT error: ${e.message}`);
      continue;
    }

    if (!userText || userText === '[inaudible]') {
      log('🤷', 'Audio inaudible');
      continue;
    }

    // Check for goodbye signals
    const lower = userText.toLowerCase();
    if (lower.includes('adiós') || lower.includes('adios') || lower.includes('hasta luego') ||
        lower.includes('no me interesa') || lower.includes('no gracias') || lower.includes('colgar')) {
      const goodbye = 'Perfecto, muchas gracias por su tiempo. Si en algún momento necesita ayuda con su ecommerce, no dude en llamarnos. Que tenga buena tarde.';
      log('🗣️', `[BOT] ${goodbye}`);
      const goodbyeAudio = generateTts(goodbye);
      await sendRtpAudio(rtpSocket, remoteIp, remoteRtpPort, goodbyeAudio, ssrc);
      break;
    }

    // AI response
    log('🤖', 'Generando respuesta...');
    let aiResponse;
    try {
      aiResponse = await generateResponse(userText, history);
      log('🗣️', `[BOT] ${aiResponse}`);
    } catch (e) {
      log('⚠️', `AI error: ${e.message}`);
      aiResponse = 'Disculpe, no le he entendido bien. ¿Podría repetir?';
    }

    history.push({ user: userText, assistant: aiResponse });

    // TTS + send
    const responseAudio = generateTts(aiResponse);
    await sendRtpAudio(rtpSocket, remoteIp, remoteRtpPort, responseAudio, ssrc);
  }

  // ─── BYE ───
  if (!hungUpRef.value) {
    log('📞', 'Colgando...');
    cseq++;
    sendSip(`BYE ${targetUri} SIP/2.0\r\nVia: SIP/2.0/UDP ${localIp}:${sipPort};branch=${genBranch()};rport\r\nFrom: "${CONFIG.callerIdName}" <sip:${CONFIG.extension}@${CONFIG.domain}>;tag=${callTag}\r\nTo: ${toHeader}\r\nCall-ID: ${callId}\r\nCSeq: ${cseq} BYE\r\nMax-Forwards: 70\r\nContent-Length: 0\r\n\r\n`);
  } else {
    log('📞', 'Llamada ya terminada por el remoto');
  }

  // Build conversation summary
  const now = new Date();
  const dateStr = now.toISOString().replace(/[T:]/g, '-').substring(0, 16);
  const summary = [
    `═══════════════════════════════════════════════`,
    `  RESUMEN DE LLAMADA`,
    `═══════════════════════════════════════════════`,
    `Fecha: ${now.toLocaleString('es-ES')}`,
    `Destino: +${CONFIG.targetNumber} (${CONFIG.targetName})`,
    `Caller: ${CONFIG.callerIdName}`,
    `Turnos: ${history.length}`,
    ``,
    `Saludo: ${CONFIG.greeting}`,
  ];
  for (const h of history) {
    summary.push(`\nCliente: ${h.user}`);
    summary.push(`Bot: ${h.assistant}`);
  }
  summary.push(`═══════════════════════════════════════════════`);

  const summaryText = summary.join('\n');
  console.log('\n' + summaryText + '\n');

  // Save to Downloads
  const safeName = CONFIG.targetName.replace(/[^a-zA-Z0-9]/g, '_');
  const txtFile = path.join(os.homedir(), 'Downloads', `llamada_${safeName}_${dateStr}.txt`);
  fs.writeFileSync(txtFile, summaryText + '\n');
  log('💾', `Resumen guardado: ${txtFile}`);

  // Cleanup sockets
  await new Promise((r) => setTimeout(r, 2000));
  sipSocket.close();
  rtpSocket.close();
  return { target: CONFIG.targetNumber, turns: history.length, file: txtFile };
}

// ═══════════════════════════════════════════════════
// MAIN — Sequential calls
// ═══════════════════════════════════════════════════
async function main() {
  log('📞', `Agente conversacional bidireccional — ${CALLS.length} llamadas`);
  log('', '═'.repeat(55));

  const results = [];
  for (let i = 0; i < CALLS.length; i++) {
    console.log(`\n${'▓'.repeat(55)}`);
    log('📋', `Llamada ${i + 1}/${CALLS.length}: +${CALLS[i].targetNumber} (${CALLS[i].targetName})`);
    console.log('▓'.repeat(55));

    const result = await makeCall(CALLS[i]);
    results.push(result);

    if (i < CALLS.length - 1) {
      log('⏳', 'Esperando 5s antes de la siguiente llamada...');
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  console.log('\n' + '═'.repeat(55));
  log('✅', 'TODAS LAS LLAMADAS COMPLETADAS');
  for (const r of results) {
    if (r) {
      log('📄', `+${r.target}: ${r.turns} turnos → ${r.file}`);
    } else {
      log('❌', 'Llamada fallida');
    }
  }
  process.exit(0);
}

main().catch((e) => { console.error('Error:', e); process.exit(1); });
