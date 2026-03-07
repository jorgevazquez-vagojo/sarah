/**
 * TTS Providers — Multi-provider text-to-speech abstraction
 *
 * Providers:
 *   edge   — Microsoft Edge TTS (Python edge_tts). Default. No GPU needed.
 *   qwen3  — Qwen3-TTS (Alibaba). Two sub-modes:
 *              · Cloud: DashScope API (DASHSCOPE_API_KEY set)
 *              · Local: self-hosted Docker service (QWEN3_TTS_URL)
 *
 * Configure via env:
 *   TTS_PROVIDER=edge|qwen3          (default: edge)
 *   TTS_VOICE=es-ES-ElviraNeural     (edge voice, default)
 *   TTS_RATE=+5%                     (edge rate, default)
 *
 *   DASHSCOPE_API_KEY=...            (qwen3 cloud, from Alibaba Cloud)
 *   QWEN3_TTS_URL=http://qwen3-tts:8020  (qwen3 local Docker service)
 *   QWEN3_TTS_VOICE=...             (natural language voice description)
 *   QWEN3_TTS_MODEL=qwen3-tts-flash (DashScope model name)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { execFileSync } = require('child_process');
const { logger } = require('../utils/logger');

// ─── Config ───
const TTS_PROVIDER = (process.env.TTS_PROVIDER || 'edge').toLowerCase();
const EDGE_VOICE = process.env.TTS_VOICE || 'es-ES-ElviraNeural';
const EDGE_RATE = process.env.TTS_RATE || '+5%';

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || '';
const QWEN3_TTS_URL = process.env.QWEN3_TTS_URL || 'http://qwen3-tts:8020';
const QWEN3_TTS_VOICE = process.env.QWEN3_TTS_VOICE || 'Scarlett'; // Warm Spanish female. Options: Scarlett, Ethan, Cherry, Serena, Chelsie, Cove
const QWEN3_TTS_MODEL = process.env.QWEN3_TTS_MODEL || 'qwen-tts-latest';

// ─── Audio conversion helpers ───

/**
 * Converts an audio file (MP3, WAV, etc.) to raw u-law bytes at 8kHz mono.
 * Uses ffmpeg (cross-platform, works in Docker/Linux).
 * Falls back to afconvert on macOS if ffmpeg not found.
 */
function convertToUlaw(inputFile) {
  const ts = Date.now() + Math.random();
  const ulawFile = path.join('/tmp', `tts-ulaw-${ts}.wav`);
  try {
    try {
      execFileSync('ffmpeg', [
        '-y', '-i', inputFile,
        '-ar', '8000', '-ac', '1',
        '-acodec', 'pcm_mulaw',
        '-f', 'wav', ulawFile
      ], { timeout: 15000, stdio: 'pipe' });
    } catch {
      // macOS fallback
      execFileSync('afconvert', ['-f', 'WAVE', '-d', 'ulaw@8000', '-c', '1', inputFile, ulawFile], { timeout: 10000 });
    }
    const wavData = fs.readFileSync(ulawFile);
    return wavData.subarray(44); // skip 44-byte WAV header
  } finally {
    try { fs.unlinkSync(ulawFile); } catch {}
  }
}

// ─── Provider: Microsoft Edge TTS ───

function generateEdgeTts(text, voice = EDGE_VOICE) {
  const ts = Date.now();
  const mp3File = path.join('/tmp', `tts-edge-${ts}.mp3`);
  const scriptFile = path.join('/tmp', `tts-script-${ts}.py`);
  fs.writeFileSync(scriptFile, `import asyncio, sys, json, edge_tts
async def main():
    args = json.loads(sys.argv[1])
    comm = edge_tts.Communicate(args['text'], args['voice'], rate=args['rate'])
    await comm.save(args['output'])
asyncio.run(main())
`);
  try {
    execFileSync('python3', [scriptFile, JSON.stringify({ text, voice, rate: EDGE_RATE, output: mp3File })], { timeout: 20000 });
    try { fs.unlinkSync(scriptFile); } catch {}
    const audioData = convertToUlaw(mp3File);
    return audioData;
  } finally {
    try { fs.unlinkSync(mp3File); } catch {}
  }
}

// ─── Provider: Qwen3-TTS local (self-hosted Docker) ───

function callLocalQwen3(text, voicePrompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ text, voice_prompt: voicePrompt });
    const url = new URL(`${QWEN3_TTS_URL}/tts`);
    const lib = url.protocol === 'https:' ? https : http;

    const req = lib.request({
      hostname: url.hostname,
      port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Qwen3-TTS local HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Qwen3-TTS local: timeout'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Provider: Qwen3-TTS cloud (DashScope OpenAI-compatible endpoint) ───
// Same pattern used in Optimus — simpler and more reliable than the custom endpoint.

function callDashscopeApi(text) {
  return new Promise((resolve, reject) => {
    // OpenAI-compatible format: returns MP3 bytes directly
    const body = JSON.stringify({
      model: QWEN3_TTS_MODEL,
      input: text,
      voice: QWEN3_TTS_VOICE,
      response_format: 'mp3',
    });

    const req = https.request({
      hostname: 'dashscope.aliyuncs.com',
      path: '/compatible-mode/v1/audio/speech',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        const err = [];
        res.on('data', (c) => err.push(c));
        res.on('end', () => reject(new Error(`DashScope HTTP ${res.statusCode}: ${Buffer.concat(err).toString().slice(0, 200)}`)));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks))); // MP3 bytes
    });

    req.setTimeout(30000, () => { req.destroy(); reject(new Error('DashScope: timeout')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Provider: Qwen3-TTS (orchestrates cloud vs local) ───

async function generateQwen3Tts(text, voicePrompt = QWEN3_TTS_VOICE) {
  const ts = Date.now();
  const audioFile = path.join('/tmp', `tts-qwen3-${ts}.wav`);
  try {
    let audioBuffer;
    if (DASHSCOPE_API_KEY) {
      logger.info('[TTS] Qwen3-TTS via DashScope cloud');
      audioBuffer = await callDashscopeApi(text);
    } else {
      logger.info('[TTS] Qwen3-TTS via local service');
      audioBuffer = await callLocalQwen3(text, voicePrompt);
    }
    fs.writeFileSync(audioFile, audioBuffer);
    return convertToUlaw(audioFile);
  } finally {
    try { fs.unlinkSync(audioFile); } catch {}
  }
}

// ─── Public API ───

/**
 * Generates TTS audio and returns raw u-law bytes at 8kHz mono (for SIP/RTP).
 *
 * @param {string} text  - Text to synthesize
 * @param {object} opts  - Optional overrides: { voice, voicePrompt }
 * @returns {Buffer}     - Raw u-law bytes
 */
async function generateTts(text, opts = {}) {
  if (TTS_PROVIDER === 'qwen3') {
    return generateQwen3Tts(text, opts.voicePrompt || QWEN3_TTS_VOICE);
  }
  // Default: edge
  return generateEdgeTts(text, opts.voice || EDGE_VOICE);
}

module.exports = { generateTts, TTS_PROVIDER };
