import { useState, useEffect } from 'react';
import { AudioQualityMonitor, CallQualityMetrics, QualityWarning } from '../lib/audio-quality';

export interface CallQualityState {
  metrics: CallQualityMetrics | null;
  warnings: string[];
  signal: 1 | 2 | 3 | 4 | 5;
  isMonitoring: boolean;
}

export function useCallQuality(monitor: AudioQualityMonitor | null) {
  const [metrics, setMetrics] = useState<CallQualityMetrics | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [signal, setSignal] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    if (!monitor) {
      setMetrics(null);
      setWarnings([]);
      setSignal(5);
      setIsMonitoring(false);
      return;
    }

    // Set up callbacks
    monitor.onMetrics = (m: CallQualityMetrics) => {
      setMetrics(m);
      setSignal(m.signal);
      setWarnings([...m.warnings]);
      setIsMonitoring(true);
    };

    monitor.onWarning = (_warning: QualityWarning) => {
      // Warnings are already reflected in metrics.warnings
      // This callback can be used for real-time notifications
    };

    monitor.onWarningCleared = (_warning: QualityWarning) => {
      // Same — reflected in next metrics update
    };

    setIsMonitoring(monitor.isActive());

    return () => {
      // Clean up callbacks when monitor changes
      monitor.onMetrics = null;
      monitor.onWarning = null;
      monitor.onWarningCleared = null;
    };
  }, [monitor]);

  return { metrics, warnings, signal, isMonitoring };
}
