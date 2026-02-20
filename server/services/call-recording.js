/**
 * Call Recording & Management Service
 *
 * - Requests PBX recording via SIP "Record: on" header
 * - Stores call recordings with 30-day retention
 * - Provides call transcription via AI (Gemini/OpenAI Whisper)
 * - Admin call monitoring via SIP ChanSpy/barge-in
 * - Automatic cleanup cron for recordings older than 30 days
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { logger } = require('../utils/logger');
const { db } = require('../utils/db');

const RECORDINGS_DIR = path.join(__dirname, '..', 'recordings');
const RETENTION_DAYS = 30;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // Every 6h

let cleanupTimer = null;

// Ensure recordings directory exists
function ensureRecordingsDir() {
  if (!fs.existsSync(RECORDINGS_DIR)) {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
    logger.info('Created recordings directory');
  }
}

// ─── Call Log Management ───

async function logCallStart({ callId, conversationId, visitorPhone, agentExtension, businessLine }) {
  try {
    const { rows } = await db.query(
      `INSERT INTO call_recordings
        (call_id, conversation_id, visitor_phone, agent_extension, business_line, status, started_at)
       VALUES ($1, $2, $3, $4, $5, 'active', NOW())
       RETURNING *`,
      [callId, conversationId, visitorPhone, agentExtension, businessLine]
    );
    return rows[0];
  } catch (e) {
    logger.warn('Failed to log call start:', e.message);
    return null;
  }
}

async function logCallEnd({ callId, duration, recordingUrl, status }) {
  try {
    await db.query(
      `UPDATE call_recordings
       SET status = $2, duration_seconds = $3, recording_url = $4, ended_at = NOW()
       WHERE call_id = $1`,
      [callId, status || 'ended', duration, recordingUrl || null]
    );
  } catch (e) {
    logger.warn('Failed to log call end:', e.message);
  }
}

// ─── Recording storage ───

function getRecordingPath(callId, ext = 'wav') {
  const hash = crypto.createHash('md5').update(callId).digest('hex').slice(0, 8);
  return path.join(RECORDINGS_DIR, `${callId}-${hash}.${ext}`);
}

async function saveRecording(callId, audioBuffer, mimeType) {
  ensureRecordingsDir();
  const ext = mimeType?.includes('wav') ? 'wav' : mimeType?.includes('mp3') ? 'mp3' : 'wav';
  const filePath = getRecordingPath(callId, ext);
  fs.writeFileSync(filePath, audioBuffer);
  const url = `/api/calls/recordings/${path.basename(filePath)}`;

  await db.query(
    `UPDATE call_recordings SET recording_url = $2, recording_path = $3, file_size_bytes = $4
     WHERE call_id = $1`,
    [callId, url, filePath, audioBuffer.length]
  );

  logger.info(`Recording saved: ${filePath} (${(audioBuffer.length / 1024).toFixed(1)} KB)`);
  return url;
}

// ─── Transcription via AI ───

async function transcribeCall(callId) {
  try {
    const { rows } = await db.query(
      `SELECT recording_path, language FROM call_recordings WHERE call_id = $1`,
      [callId]
    );
    if (!rows[0]?.recording_path) throw new Error('No recording file found');

    const filePath = rows[0].recording_path;
    if (!fs.existsSync(filePath)) throw new Error('Recording file missing from disk');

    const audioBuffer = fs.readFileSync(filePath);
    let transcript = '';

    // Try OpenAI Whisper first (best for transcription)
    if (process.env.OPENAI_API_KEY) {
      transcript = await whisperTranscribe(audioBuffer, rows[0].language || 'es');
    } else if (process.env.GEMINI_API_KEY) {
      transcript = await geminiTranscribe(audioBuffer, rows[0].language || 'es');
    } else {
      throw new Error('No AI provider configured for transcription');
    }

    // Save transcript
    await db.query(
      `UPDATE call_recordings SET transcript = $2, transcribed_at = NOW() WHERE call_id = $1`,
      [callId, transcript]
    );

    logger.info(`Call ${callId} transcribed (${transcript.length} chars)`);
    return transcript;
  } catch (e) {
    logger.warn(`Transcription failed for ${callId}: ${e.message}`);
    throw e;
  }
}

async function whisperTranscribe(audioBuffer, language) {
  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const file = new File([audioBuffer], 'call.wav', { type: 'audio/wav' });
  const response = await client.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    language: language === 'gl' ? 'es' : language, // Whisper doesn't support Galician
  });
  return response.text;
}

async function geminiTranscribe(audioBuffer, language) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const base64Audio = audioBuffer.toString('base64');
  const result = await model.generateContent([
    { inlineData: { mimeType: 'audio/wav', data: base64Audio } },
    `Transcribe this phone call audio to text in ${language}. Include speaker labels if possible (Visitor: / Agent:). Return only the transcript, no commentary.`,
  ]);

  return result.response.text();
}

// ─── Call list for dashboard ───

async function getCallRecordings({ limit = 50, offset = 0, businessLine, status } = {}) {
  const conds = [];
  const vals = [];
  let i = 1;

  if (businessLine) { conds.push(`business_line = $${i++}`); vals.push(businessLine); }
  if (status) { conds.push(`status = $${i++}`); vals.push(status); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  vals.push(limit, offset);

  const { rows } = await db.query(
    `SELECT id, call_id, conversation_id, visitor_phone, agent_extension, business_line,
            status, duration_seconds, recording_url, transcript IS NOT NULL AS has_transcript,
            started_at, ended_at, monitored_by, monitor_started_at
     FROM call_recordings
     ${where}
     ORDER BY started_at DESC
     LIMIT $${i++} OFFSET $${i}`,
    vals
  );
  return rows;
}

async function getCallDetail(callId) {
  const { rows } = await db.query(
    `SELECT * FROM call_recordings WHERE call_id = $1`,
    [callId]
  );
  return rows[0] || null;
}

// ─── Admin call monitoring ───

async function startMonitoring(callId, agentId) {
  await db.query(
    `UPDATE call_recordings SET monitored_by = $2, monitor_started_at = NOW() WHERE call_id = $1`,
    [callId, agentId]
  );
  logger.info(`Admin ${agentId} started monitoring call ${callId}`);
}

async function stopMonitoring(callId) {
  await db.query(
    `UPDATE call_recordings SET monitored_by = NULL, monitor_started_at = NULL WHERE call_id = $1`,
    [callId]
  );
}

// ─── 30-day retention cleanup ───

async function cleanupOldRecordings() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  logger.info(`Cleanup: removing recordings older than ${cutoff.toISOString()}`);

  try {
    // Get recordings to delete
    const { rows } = await db.query(
      `SELECT id, call_id, recording_path FROM call_recordings
       WHERE started_at < $1 AND recording_path IS NOT NULL`,
      [cutoff]
    );

    let filesDeleted = 0;
    for (const row of rows) {
      if (row.recording_path && fs.existsSync(row.recording_path)) {
        fs.unlinkSync(row.recording_path);
        filesDeleted++;
      }
    }

    // Clear recording data but keep call metadata (set recording fields to null)
    const { rowCount } = await db.query(
      `UPDATE call_recordings
       SET recording_url = NULL, recording_path = NULL, file_size_bytes = NULL,
           transcript = NULL, retention_note = 'Cleaned after 30 days'
       WHERE started_at < $1 AND (recording_path IS NOT NULL OR transcript IS NOT NULL)`,
      [cutoff]
    );

    // Delete very old call metadata (90 days)
    const oldCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const { rowCount: deleted } = await db.query(
      `DELETE FROM call_recordings WHERE started_at < $1`,
      [oldCutoff]
    );

    logger.info(`Cleanup done: ${filesDeleted} files deleted, ${rowCount} recordings cleaned, ${deleted} old records purged`);
    return { filesDeleted, recordsCleaned: rowCount, recordsPurged: deleted };
  } catch (e) {
    logger.error('Recording cleanup failed:', e.message);
    return { error: e.message };
  }
}

// ─── Call stats ───

async function getCallStats() {
  try {
    const { rows } = await db.query(`
      SELECT
        COUNT(*) AS total_calls,
        COUNT(*) FILTER (WHERE status = 'active') AS active_calls,
        COUNT(*) FILTER (WHERE status = 'ended') AS completed_calls,
        COUNT(*) FILTER (WHERE status = 'failed' OR status = 'missed') AS failed_calls,
        COUNT(*) FILTER (WHERE recording_url IS NOT NULL) AS recorded_calls,
        COUNT(*) FILTER (WHERE transcript IS NOT NULL) AS transcribed_calls,
        COALESCE(AVG(duration_seconds) FILTER (WHERE duration_seconds > 0), 0) AS avg_duration,
        COALESCE(SUM(file_size_bytes), 0) AS total_storage_bytes
      FROM call_recordings
      WHERE started_at > NOW() - INTERVAL '30 days'
    `);
    return rows[0];
  } catch (e) {
    logger.warn('Call stats failed:', e.message);
    return {};
  }
}

// ─── Init cleanup cron ───

function initRecordingCleanup() {
  ensureRecordingsDir();

  // Run cleanup on startup (async)
  setTimeout(() => cleanupOldRecordings().catch(() => {}), 60000);

  // Then every 6 hours
  cleanupTimer = setInterval(() => {
    cleanupOldRecordings().catch(() => {});
  }, CLEANUP_INTERVAL_MS);

  logger.info('Call recording cleanup initialized (retention: 30 days, check: 6h)');
}

function stopRecordingCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

module.exports = {
  logCallStart,
  logCallEnd,
  saveRecording,
  transcribeCall,
  getCallRecordings,
  getCallDetail,
  startMonitoring,
  stopMonitoring,
  cleanupOldRecordings,
  getCallStats,
  initRecordingCleanup,
  stopRecordingCleanup,
  RECORDINGS_DIR,
};
