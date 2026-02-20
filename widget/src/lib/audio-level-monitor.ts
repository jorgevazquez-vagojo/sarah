// ─── Real-time Audio Level Monitor (Web Audio API) ───
// High-frequency audio level analysis for smooth VU meter visualization.
// The existing audio-quality.ts polls getStats() every 2s — too slow for visual feedback.
// This module uses Web Audio API AnalyserNode for ~60fps level monitoring.
//
// INTEGRATION WITH WIDGET.TSX:
//
// 1. Import the hook in Widget.tsx:
//    import { useAudioLevel } from './hooks/useAudioLevel';
//
// 2. The useSIP hook needs to expose localStream.
//    In useSIP.ts, add:
//      const [localStream, setLocalStream] = useState<MediaStream | null>(null);
//    Then in the SIP client, after getUserMedia succeeds, call setLocalStream(stream).
//    On hangup/destroy, call setLocalStream(null).
//    Return localStream from the hook: return { ..., localStream };
//
// 3. In the Widget component, after getting the SIP state:
//    const { callState, isMuted, startCall, hangup, toggleMute, qualityMonitor, localStream } = sip;
//    const audioLevel = useAudioLevel(localStream);
//
// 4. In CallView, when sipState is 'active', place the indicator next to the mute button:
//    <AudioLevelIndicator
//      level={audioLevel.level}
//      peak={audioLevel.peak}
//      micStatus={isMuted ? 'muted' : audioLevel.micStatus}
//    />
//
// 5. Place it next to the mute button or below the call timer.
//

export type MicStatus = 'active' | 'silent' | 'muted' | 'disconnected';

export interface AudioLevelState {
  /** RMS-normalized audio level, 0.0 - 1.0 */
  level: number;
  /** Peak level with exponential decay, 0.0 - 1.0 */
  peak: number;
  /** True if no audio detected for 3+ seconds */
  isSilent: boolean;
  /** True if level consistently > 0.95 for 500ms+ */
  isClipping: boolean;
  /** Current microphone status */
  micStatus: MicStatus;
}

// ─── Constants ───
const SILENCE_THRESHOLD = 0.01;
const SILENCE_DURATION_MS = 3000;
const CLIPPING_THRESHOLD = 0.95;
const CLIPPING_DURATION_MS = 500;
const PEAK_DECAY_RATE = 0.95; // per frame — exponential decay
const FFT_SIZE = 256;

export class AudioLevelMonitor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private stream: MediaStream | null = null;

  // Current state
  private currentLevel = 0;
  private currentPeak = 0;
  private silent = false;
  private clipping = false;
  private status: MicStatus = 'disconnected';

  // Timing trackers
  private silenceStartTime: number | null = null;
  private clippingStartTime: number | null = null;
  private monitoring = false;

  // Status change callback
  onStatusChange?: (status: MicStatus) => void;

  constructor() {
    // No-op constructor — initialization happens in start()
  }

  /**
   * Start monitoring a MediaStream (from getUserMedia).
   * Creates AudioContext + AnalyserNode for real-time level analysis.
   */
  start(stream: MediaStream): void {
    // Clean up any previous session
    this.stop();

    this.stream = stream;

    // Check if the stream has audio tracks
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      this.setStatus('disconnected');
      return;
    }

    try {
      // Create AudioContext (handle browser prefixes)
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        console.warn('[AudioLevelMonitor] Web Audio API not supported');
        return;
      }

      this.audioContext = new AudioCtx();

      // Handle suspended AudioContext (requires user gesture in some browsers)
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {
          // Will retry on next user interaction
        });
      }

      // Create AnalyserNode
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = FFT_SIZE;
      this.analyser.smoothingTimeConstant = 0.3;

      // Connect MediaStream -> AnalyserNode
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.sourceNode.connect(this.analyser);

      // Allocate data buffer for frequency analysis
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      // Reset state
      this.currentLevel = 0;
      this.currentPeak = 0;
      this.silent = false;
      this.clipping = false;
      this.silenceStartTime = null;
      this.clippingStartTime = null;
      this.monitoring = true;

      this.setStatus('active');

      // Listen for track ending externally
      const track = audioTracks[0];
      track.addEventListener('ended', this.handleTrackEnded);
      track.addEventListener('mute', this.handleTrackMute);
      track.addEventListener('unmute', this.handleTrackUnmute);
    } catch (err) {
      console.error('[AudioLevelMonitor] Failed to start:', err);
      this.stop();
    }
  }

  /**
   * Stop monitoring and release all resources.
   */
  stop(): void {
    this.monitoring = false;

    // Remove track event listeners
    if (this.stream) {
      const tracks = this.stream.getAudioTracks();
      for (const track of tracks) {
        track.removeEventListener('ended', this.handleTrackEnded);
        track.removeEventListener('mute', this.handleTrackMute);
        track.removeEventListener('unmute', this.handleTrackUnmute);
      }
    }

    // Disconnect Web Audio nodes
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch { /* already disconnected */ }
      this.sourceNode = null;
    }

    if (this.analyser) {
      try { this.analyser.disconnect(); } catch { /* already disconnected */ }
      this.analyser = null;
    }

    // Close AudioContext
    if (this.audioContext) {
      if (this.audioContext.state !== 'closed') {
        this.audioContext.close().catch(() => { /* ignore */ });
      }
      this.audioContext = null;
    }

    this.dataArray = null;
    this.stream = null;

    // Reset state
    this.currentLevel = 0;
    this.currentPeak = 0;
    this.silent = false;
    this.clipping = false;
    this.silenceStartTime = null;
    this.clippingStartTime = null;
    this.setStatus('disconnected');
  }

  /**
   * Get the current audio level state.
   * Call this at requestAnimationFrame rate for smooth UI updates.
   * Performs the actual AnalyserNode read on each call.
   */
  getLevel(): AudioLevelState {
    if (!this.monitoring || !this.analyser || !this.dataArray || !this.stream) {
      return {
        level: 0,
        peak: 0,
        isSilent: true,
        isClipping: false,
        micStatus: this.status,
      };
    }

    // Check track state first
    const track = this.stream.getAudioTracks()[0];
    if (!track || track.readyState !== 'live') {
      this.setStatus('disconnected');
      return {
        level: 0,
        peak: 0,
        isSilent: true,
        isClipping: false,
        micStatus: 'disconnected',
      };
    }

    // Handle AudioContext suspended state
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => { /* ignore */ });
    }

    // Read time-domain data for RMS calculation
    this.analyser.getByteTimeDomainData(this.dataArray);

    // Calculate RMS (Root Mean Square) for smooth level
    let sumSquares = 0;
    let allZero = true;
    const length = this.dataArray.length;

    for (let i = 0; i < length; i++) {
      // Byte time domain data is 0-255 where 128 = silence
      const normalized = (this.dataArray[i] - 128) / 128;
      sumSquares += normalized * normalized;
      if (this.dataArray[i] !== 128) {
        allZero = false;
      }
    }

    const rms = Math.sqrt(sumSquares / length);

    // Clamp to 0-1 range (RMS of a full-scale sine wave is ~0.707)
    // Scale up slightly so normal speech fills more of the 0-1 range
    const scaledLevel = Math.min(1, rms * 1.8);
    this.currentLevel = scaledLevel;

    // Peak with exponential decay
    if (scaledLevel > this.currentPeak) {
      this.currentPeak = scaledLevel;
    } else {
      this.currentPeak *= PEAK_DECAY_RATE;
    }

    const now = Date.now();

    // ── Mute detection ──
    // Browser-level mute produces exact zeros (all bytes = 128 in time domain)
    // A quiet room still has noise floor > 0
    if (allZero && !track.enabled) {
      this.setStatus('muted');
      this.silenceStartTime = null;
      this.clippingStartTime = null;
      return {
        level: 0,
        peak: 0,
        isSilent: false,
        isClipping: false,
        micStatus: 'muted',
      };
    }

    // Also detect mute via track.enabled (software mute)
    if (!track.enabled) {
      this.setStatus('muted');
      return {
        level: 0,
        peak: 0,
        isSilent: false,
        isClipping: false,
        micStatus: 'muted',
      };
    }

    // ── Silence detection ──
    if (rms < SILENCE_THRESHOLD) {
      if (this.silenceStartTime === null) {
        this.silenceStartTime = now;
      }
      if (now - this.silenceStartTime >= SILENCE_DURATION_MS) {
        this.silent = true;
        this.setStatus('silent');
      }
    } else {
      this.silenceStartTime = null;
      if (this.silent) {
        this.silent = false;
        this.setStatus('active');
      }
    }

    // ── Clipping detection ──
    if (rms > CLIPPING_THRESHOLD) {
      if (this.clippingStartTime === null) {
        this.clippingStartTime = now;
      }
      if (now - this.clippingStartTime >= CLIPPING_DURATION_MS) {
        this.clipping = true;
      }
    } else {
      this.clippingStartTime = null;
      this.clipping = false;
    }

    // If not silent and not muted, ensure status is active
    if (!this.silent && this.status !== 'active' && this.status !== 'disconnected') {
      this.setStatus('active');
    }

    return {
      level: this.currentLevel,
      peak: this.currentPeak,
      isSilent: this.silent,
      isClipping: this.clipping,
      micStatus: this.status,
    };
  }

  /**
   * Whether the monitor is currently active and processing audio.
   */
  isActive(): boolean {
    return this.monitoring;
  }

  // ─── Private helpers ───

  private setStatus(newStatus: MicStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.onStatusChange?.(newStatus);
    }
  }

  private handleTrackEnded = (): void => {
    this.setStatus('disconnected');
    this.monitoring = false;
  };

  private handleTrackMute = (): void => {
    this.setStatus('muted');
  };

  private handleTrackUnmute = (): void => {
    if (this.monitoring) {
      this.setStatus('active');
    }
  };
}
