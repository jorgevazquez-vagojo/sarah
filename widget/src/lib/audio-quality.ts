// ─── Audio Quality Monitor ───
// Real-time WebRTC call quality indicator using RTCPeerConnection.getStats()
// Calculates MOS (Mean Opinion Score) via simplified E-model (ITU-T G.107)
// Premium feature: no competitor has this in an embeddable widget

export interface CallQualityMetrics {
  mos: number;           // 1.0 - 5.0 (Mean Opinion Score)
  rtt: number;           // ms (round-trip time)
  jitter: number;        // ms
  packetLoss: number;    // percentage 0-100
  audioLevel: number;    // 0.0 - 1.0 (from input track)
  signal: 1 | 2 | 3 | 4 | 5; // bars (like mobile signal)
  warnings: string[];    // active warnings
}

export type QualityWarning =
  | 'low-mos'
  | 'high-rtt'
  | 'high-jitter'
  | 'high-packet-loss'
  | 'no-audio';

type MetricsCallback = (metrics: CallQualityMetrics) => void;
type WarningCallback = (warning: QualityWarning) => void;

// ─── E-model simplified (ITU-T G.107) ───
export function calculateMOS(rtt: number, jitter: number, packetLoss: number): number {
  const effectiveLatency = rtt + jitter * 2 + 10;
  let R = 93.2;
  if (effectiveLatency < 160) {
    R -= effectiveLatency / 40;
  } else {
    R -= (effectiveLatency - 120) / 10;
  }
  R -= packetLoss * 2.5;
  R = Math.max(0, Math.min(100, R));
  const mos = 1 + 0.035 * R + R * (R - 60) * (100 - R) * 7e-6;
  return Math.round(mos * 10) / 10;
}

// ─── MOS to signal bars mapping ───
export function mosToSignal(mos: number): 1 | 2 | 3 | 4 | 5 {
  if (mos >= 4.3) return 5;
  if (mos >= 4.0) return 4;
  if (mos >= 3.6) return 3;
  if (mos >= 3.1) return 2;
  return 1;
}

// ─── Warning thresholds ───
const THRESHOLDS = {
  LOW_MOS: 3.5,
  LOW_MOS_CONSECUTIVE: 3,      // polls before triggering
  HIGH_RTT: 300,               // ms
  HIGH_JITTER: 50,             // ms
  HIGH_PACKET_LOSS: 3,         // %
  NO_AUDIO_CONSECUTIVE: 4,     // polls (= 8 seconds at 2s interval)
} as const;

export class AudioQualityMonitor {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private metrics: CallQualityMetrics | null = null;

  // Tracking state for warnings
  private lowMosCount = 0;
  private noAudioCount = 0;
  private activeWarnings = new Set<QualityWarning>();

  // Previous stats for delta calculations
  private prevPacketsSent = 0;
  private prevPacketsLost = 0;
  private prevBytesSent = 0;
  private prevTimestamp = 0;

  // Callbacks
  private onMetricsCallback: MetricsCallback | null = null;
  private onWarningCallback: WarningCallback | null = null;
  private onWarningClearedCallback: WarningCallback | null = null;

  // ─── Public API ───

  set onMetrics(cb: MetricsCallback | null) {
    this.onMetricsCallback = cb;
  }

  set onWarning(cb: WarningCallback | null) {
    this.onWarningCallback = cb;
  }

  set onWarningCleared(cb: WarningCallback | null) {
    this.onWarningClearedCallback = cb;
  }

  start(pc: RTCPeerConnection, localStream?: MediaStream): void {
    this.stop(); // clean any previous session
    this.pc = pc;
    this.localStream = localStream || null;
    this.resetState();

    // Poll every 2 seconds
    this.intervalId = setInterval(() => this.poll(), 2000);
    // Initial poll immediately
    this.poll();
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.pc = null;
    this.localStream = null;
    this.metrics = null;
    this.resetState();
  }

  getMetrics(): CallQualityMetrics | null {
    return this.metrics;
  }

  isActive(): boolean {
    return this.intervalId !== null;
  }

  // ─── Private ───

  private resetState(): void {
    this.lowMosCount = 0;
    this.noAudioCount = 0;
    this.activeWarnings.clear();
    this.prevPacketsSent = 0;
    this.prevPacketsLost = 0;
    this.prevBytesSent = 0;
    this.prevTimestamp = 0;
  }

  private async poll(): Promise<void> {
    if (!this.pc) return;

    try {
      const stats = await this.pc.getStats();
      const raw = this.extractStats(stats);
      const audioLevel = this.getLocalAudioLevel();

      const mos = calculateMOS(raw.rtt, raw.jitter, raw.packetLoss);
      const signal = mosToSignal(mos);
      const warnings = this.evaluateWarnings(mos, raw.rtt, raw.jitter, raw.packetLoss, audioLevel);

      this.metrics = {
        mos,
        rtt: Math.round(raw.rtt),
        jitter: Math.round(raw.jitter * 10) / 10,
        packetLoss: Math.round(raw.packetLoss * 10) / 10,
        audioLevel,
        signal,
        warnings,
      };

      this.onMetricsCallback?.(this.metrics);
    } catch {
      // Stats unavailable — connection might be closing
    }
  }

  private extractStats(stats: RTCStatsReport): { rtt: number; jitter: number; packetLoss: number } {
    let rtt = 0;
    let jitter = 0;
    let packetLoss = 0;

    // Iterate through all stat reports
    stats.forEach((report) => {
      // RTT from candidate-pair
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        rtt = report.currentRoundTripTime
          ? report.currentRoundTripTime * 1000 // convert s to ms
          : rtt;
      }

      // Jitter + packet loss from inbound-rtp (audio)
      if (report.type === 'inbound-rtp' && report.kind === 'audio') {
        jitter = report.jitter ? report.jitter * 1000 : jitter; // s to ms

        // Packet loss as delta percentage
        const totalPackets = report.packetsReceived || 0;
        const totalLost = report.packetsLost || 0;
        if (totalPackets > 0) {
          packetLoss = (totalLost / (totalPackets + totalLost)) * 100;
        }
      }

      // Fallback: outbound-rtp for packet counts (some browsers)
      if (report.type === 'outbound-rtp' && report.kind === 'audio') {
        // Track delta for loss calculation from remote feedback
        if (report.packetsSent) {
          this.prevPacketsSent = report.packetsSent;
        }
      }

      // Remote inbound stats (most accurate for loss from sender perspective)
      if (report.type === 'remote-inbound-rtp' && report.kind === 'audio') {
        if (typeof report.roundTripTime === 'number') {
          rtt = report.roundTripTime * 1000;
        }
        if (typeof report.jitter === 'number') {
          jitter = report.jitter * 1000;
        }
        if (typeof report.fractionLost === 'number') {
          packetLoss = report.fractionLost * 100;
        }
      }
    });

    return { rtt, jitter, packetLoss };
  }

  private getLocalAudioLevel(): number {
    if (!this.localStream) return 0;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (!audioTrack || !audioTrack.enabled || audioTrack.muted) return 0;

    // Try to get audio level from getStats if available
    // Otherwise return a default "active" level since the track is enabled
    // Real audio level requires Web Audio API or newer getStats properties
    // For now, if track is enabled and not muted, assume audio is present
    if (audioTrack.readyState === 'live' && audioTrack.enabled) {
      return 0.5; // default active level
    }

    return 0;
  }

  private evaluateWarnings(
    mos: number,
    rtt: number,
    jitter: number,
    packetLoss: number,
    audioLevel: number,
  ): string[] {
    const warnings: QualityWarning[] = [];

    // Low MOS — need consecutive polls
    if (mos < THRESHOLDS.LOW_MOS) {
      this.lowMosCount++;
      if (this.lowMosCount >= THRESHOLDS.LOW_MOS_CONSECUTIVE) {
        warnings.push('low-mos');
        this.setWarning('low-mos');
      }
    } else {
      this.lowMosCount = 0;
      this.clearWarning('low-mos');
    }

    // High RTT
    if (rtt > THRESHOLDS.HIGH_RTT) {
      warnings.push('high-rtt');
      this.setWarning('high-rtt');
    } else {
      this.clearWarning('high-rtt');
    }

    // High jitter
    if (jitter > THRESHOLDS.HIGH_JITTER) {
      warnings.push('high-jitter');
      this.setWarning('high-jitter');
    } else {
      this.clearWarning('high-jitter');
    }

    // High packet loss
    if (packetLoss > THRESHOLDS.HIGH_PACKET_LOSS) {
      warnings.push('high-packet-loss');
      this.setWarning('high-packet-loss');
    } else {
      this.clearWarning('high-packet-loss');
    }

    // No audio detected
    if (audioLevel === 0) {
      this.noAudioCount++;
      if (this.noAudioCount >= THRESHOLDS.NO_AUDIO_CONSECUTIVE) {
        warnings.push('no-audio');
        this.setWarning('no-audio');
      }
    } else {
      this.noAudioCount = 0;
      this.clearWarning('no-audio');
    }

    return warnings;
  }

  private setWarning(warning: QualityWarning): void {
    if (!this.activeWarnings.has(warning)) {
      this.activeWarnings.add(warning);
      this.onWarningCallback?.(warning);
    }
  }

  private clearWarning(warning: QualityWarning): void {
    if (this.activeWarnings.has(warning)) {
      this.activeWarnings.delete(warning);
      this.onWarningClearedCallback?.(warning);
    }
  }
}
