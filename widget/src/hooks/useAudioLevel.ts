// ─── React hook for real-time audio level monitoring ───
// Wraps AudioLevelMonitor with proper React lifecycle management.
// Uses requestAnimationFrame for smooth ~60fps reads, but throttles
// React state updates to ~15fps (~66ms) to avoid excessive re-renders.

import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioLevelMonitor, AudioLevelState, MicStatus } from '../lib/audio-level-monitor';

export interface UseAudioLevelResult {
  /** RMS-normalized audio level, 0.0 - 1.0 */
  level: number;
  /** Peak level with exponential decay, 0.0 - 1.0 */
  peak: number;
  /** Current microphone status */
  micStatus: MicStatus;
  /** True if no audio detected for 3+ seconds */
  isSilent: boolean;
  /** True if audio is clipping (level > 0.95 for 500ms+) */
  isClipping: boolean;
}

// Throttle interval for React state updates (ms)
// ~15fps is smooth enough for bar animation while avoiding excessive re-renders
const STATE_UPDATE_INTERVAL_MS = 66;

export function useAudioLevel(stream: MediaStream | null): UseAudioLevelResult {
  const [state, setState] = useState<UseAudioLevelResult>({
    level: 0,
    peak: 0,
    micStatus: 'disconnected',
    isSilent: true,
    isClipping: false,
  });

  const monitorRef = useRef<AudioLevelMonitor | null>(null);
  const rafIdRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);

  // Animation frame loop — reads at ~60fps, updates React state at ~15fps
  const tick = useCallback(() => {
    const monitor = monitorRef.current;
    if (!monitor || !monitor.isActive()) {
      return;
    }

    const levelState: AudioLevelState = monitor.getLevel();
    const now = performance.now();

    // Throttle React state updates to ~15fps
    if (now - lastUpdateRef.current >= STATE_UPDATE_INTERVAL_MS) {
      lastUpdateRef.current = now;
      setState({
        level: levelState.level,
        peak: levelState.peak,
        micStatus: levelState.micStatus,
        isSilent: levelState.isSilent,
        isClipping: levelState.isClipping,
      });
    }

    rafIdRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    // Clean up previous monitor
    if (monitorRef.current) {
      monitorRef.current.stop();
      monitorRef.current = null;
    }
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    }

    if (!stream) {
      setState({
        level: 0,
        peak: 0,
        micStatus: 'disconnected',
        isSilent: true,
        isClipping: false,
      });
      return;
    }

    // Verify stream has audio tracks
    if (stream.getAudioTracks().length === 0) {
      setState({
        level: 0,
        peak: 0,
        micStatus: 'disconnected',
        isSilent: true,
        isClipping: false,
      });
      return;
    }

    // Create and start the monitor
    const monitor = new AudioLevelMonitor();
    monitorRef.current = monitor;

    monitor.onStatusChange = (status: MicStatus) => {
      setState((prev) => {
        if (prev.micStatus === status) return prev;
        return { ...prev, micStatus: status };
      });
    };

    monitor.start(stream);

    // Start the animation frame loop
    lastUpdateRef.current = performance.now();
    rafIdRef.current = requestAnimationFrame(tick);

    // Cleanup on unmount or stream change
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
      if (monitorRef.current) {
        monitorRef.current.stop();
        monitorRef.current = null;
      }
    };
  }, [stream, tick]);

  return state;
}
