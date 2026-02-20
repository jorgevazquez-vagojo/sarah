// Call Recording Service tests
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const mockQuery = jest.fn();
jest.mock('../utils/db', () => ({
  db: { query: mockQuery },
}));

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(),
    unlinkSync: jest.fn(),
  };
});

const fs = require('fs');
const path = require('path');
const {
  logCallStart,
  logCallEnd,
  saveRecording,
  getCallRecordings,
  getCallDetail,
  startMonitoring,
  stopMonitoring,
  cleanupOldRecordings,
  getCallStats,
  RECORDINGS_DIR,
} = require('../services/call-recording');

describe('Call Recording Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logCallStart', () => {
    test('inserts call record into database', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, call_id: 'call-1' }] });

      const result = await logCallStart({
        callId: 'call-1',
        conversationId: 'conv-1',
        visitorPhone: '+34612345678',
        agentExtension: '200',
        businessLine: 'boostic',
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO call_recordings'),
        ['call-1', 'conv-1', '+34612345678', '200', 'boostic']
      );
      expect(result).toEqual({ id: 1, call_id: 'call-1' });
    });

    test('returns null on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

      const result = await logCallStart({
        callId: 'call-err',
        visitorPhone: '123',
      });

      expect(result).toBeNull();
    });
  });

  describe('logCallEnd', () => {
    test('updates call record with status and duration', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await logCallEnd({
        callId: 'call-1',
        duration: 120,
        status: 'ended',
        recordingUrl: '/api/calls/recordings/call-1.wav',
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE call_recordings'),
        ['call-1', 'ended', 120, '/api/calls/recordings/call-1.wav']
      );
    });

    test('uses default status "ended" when not specified', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      await logCallEnd({ callId: 'call-1' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        ['call-1', 'ended', undefined, null]
      );
    });

    test('handles database errors gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      // Should not throw
      await expect(logCallEnd({ callId: 'fail' })).resolves.toBeUndefined();
    });
  });

  describe('saveRecording', () => {
    test('saves WAV file and updates database', async () => {
      fs.existsSync.mockReturnValue(true);
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const audioBuffer = Buffer.from('fake-audio-data');
      const url = await saveRecording('call-1', audioBuffer, 'audio/wav');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('call-1'),
        audioBuffer
      );
      expect(url).toContain('/api/calls/recordings/');
      expect(url).toContain('.wav');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE call_recordings'),
        expect.arrayContaining(['call-1'])
      );
    });

    test('uses correct extension for MP3', async () => {
      fs.existsSync.mockReturnValue(true);
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const url = await saveRecording('call-2', Buffer.from('mp3'), 'audio/mp3');
      expect(url).toContain('.mp3');
    });

    test('defaults to WAV for unknown mime types', async () => {
      fs.existsSync.mockReturnValue(true);
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const url = await saveRecording('call-3', Buffer.from('data'), 'audio/unknown');
      expect(url).toContain('.wav');
    });
  });

  describe('getCallRecordings', () => {
    test('returns call list with default pagination', async () => {
      const mockRows = [
        { id: 1, call_id: 'call-1', status: 'ended' },
        { id: 2, call_id: 'call-2', status: 'active' },
      ];
      mockQuery.mockResolvedValueOnce({ rows: mockRows });

      const result = await getCallRecordings();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY started_at DESC'),
        expect.arrayContaining([50, 0])
      );
      expect(result).toEqual(mockRows);
    });

    test('filters by business line', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await getCallRecordings({ businessLine: 'tech' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('business_line = $1'),
        expect.arrayContaining(['tech'])
      );
    });

    test('filters by status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await getCallRecordings({ status: 'active' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('status = $1'),
        expect.arrayContaining(['active'])
      );
    });

    test('filters by both business line and status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await getCallRecordings({ businessLine: 'boostic', status: 'ended' });

      const sql = mockQuery.mock.calls[0][0];
      expect(sql).toContain('business_line = $1');
      expect(sql).toContain('status = $2');
    });
  });

  describe('getCallDetail', () => {
    test('returns call record by callId', async () => {
      const mockCall = { id: 1, call_id: 'call-1', transcript: 'Hello...' };
      mockQuery.mockResolvedValueOnce({ rows: [mockCall] });

      const result = await getCallDetail('call-1');
      expect(result).toEqual(mockCall);
    });

    test('returns null when call not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await getCallDetail('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('startMonitoring / stopMonitoring', () => {
    test('startMonitoring updates call record', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      await startMonitoring('call-1', 'agent-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('monitored_by'),
        ['call-1', 'agent-1']
      );
    });

    test('stopMonitoring clears monitoring fields', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      await stopMonitoring('call-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('monitored_by = NULL'),
        ['call-1']
      );
    });
  });

  describe('cleanupOldRecordings', () => {
    test('deletes old recording files and cleans database', async () => {
      const oldRecordings = [
        { id: 1, call_id: 'old-1', recording_path: '/recordings/old-1.wav' },
        { id: 2, call_id: 'old-2', recording_path: '/recordings/old-2.wav' },
      ];

      // SELECT old recordings
      mockQuery.mockResolvedValueOnce({ rows: oldRecordings });
      // UPDATE: clear recording data
      mockQuery.mockResolvedValueOnce({ rowCount: 2 });
      // DELETE very old metadata
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      fs.existsSync.mockReturnValue(true);

      const result = await cleanupOldRecordings();

      expect(fs.unlinkSync).toHaveBeenCalledTimes(2);
      expect(result.filesDeleted).toBe(2);
      expect(result.recordsCleaned).toBe(2);
      expect(result.recordsPurged).toBe(1);
    });

    test('handles missing files gracefully', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, call_id: 'missing', recording_path: '/recordings/missing.wav' }],
      });
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      fs.existsSync.mockReturnValue(false);

      const result = await cleanupOldRecordings();
      expect(fs.unlinkSync).not.toHaveBeenCalled();
      expect(result.filesDeleted).toBe(0);
    });

    test('returns error on database failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB down'));

      const result = await cleanupOldRecordings();
      expect(result.error).toBe('DB down');
    });
  });

  describe('getCallStats', () => {
    test('returns aggregated stats', async () => {
      const mockStats = {
        total_calls: '42',
        active_calls: '2',
        completed_calls: '35',
        failed_calls: '5',
        recorded_calls: '20',
        transcribed_calls: '10',
        avg_duration: '180.5',
        total_storage_bytes: '1048576',
      };
      mockQuery.mockResolvedValueOnce({ rows: [mockStats] });

      const result = await getCallStats();
      expect(result).toEqual(mockStats);
    });

    test('returns empty object on error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('query fail'));
      const result = await getCallStats();
      expect(result).toEqual({});
    });
  });
});
