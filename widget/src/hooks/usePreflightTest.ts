// ─── usePreflightTest — React hook for WebRTC preflight diagnostics ───
// Wraps the preflight engine with React state management and a ready-to-use
// PreflightUI component for rendering step-by-step progress in the widget.
//
// Usage in Widget.tsx:
//
//   import { usePreflightTest } from './hooks/usePreflightTest';
//
//   function CallView(props) {
//     const preflight = usePreflightTest();
//
//     // When user clicks Call:
//     // 1. Start preflight
//     // 2. On success → proceed with SIP
//     // 3. On failure → show callback form
//
//     useEffect(() => {
//       if (!preflight.result && !preflight.isRunning) {
//         preflight.runPreflight();
//       }
//     }, []);
//
//     if (preflight.isRunning || (preflight.result && !preflight.dismissed)) {
//       return <PreflightUI preflight={preflight} onProceed={startSipCall} onCallback={showCallbackForm} />;
//     }
//     // ... rest of call view
//   }

import { useState, useCallback, useRef } from 'react';
import {
  PreflightStep,
  PreflightStepResult,
  PreflightStepStatus,
  PreflightResult,
  PreflightOverall,
  runPreflightTest,
  runQuickCheck,
  clearPreflightCache,
} from '../lib/preflight-test';

// Re-export types for consumers
export type {
  PreflightStep,
  PreflightStepResult,
  PreflightStepStatus,
  PreflightResult,
  PreflightOverall,
};

export { runQuickCheck, clearPreflightCache };

// ─── Step metadata for UI rendering ───

export interface PreflightStepMeta {
  step: PreflightStep;
  label: string;
  description: string;
}

export const PREFLIGHT_STEP_META: PreflightStepMeta[] = [
  {
    step: 'browser',
    label: 'Navegador',
    description: 'Compatibilidad WebRTC',
  },
  {
    step: 'microphone',
    label: 'Microfono',
    description: 'Acceso y audio',
  },
  {
    step: 'network',
    label: 'Conectividad',
    description: 'STUN/TURN y NAT',
  },
  {
    step: 'quality',
    label: 'Calidad de red',
    description: 'Latencia y MOS',
  },
  {
    step: 'codec',
    label: 'Codecs',
    description: 'Audio Opus',
  },
];

// ─── Hook return type ───

export interface UsePreflightReturn {
  /** Start the full preflight test */
  runPreflight: (iceServers?: RTCIceServer[]) => Promise<PreflightResult>;
  /** Whether the test is currently running */
  isRunning: boolean;
  /** Per-step progress map, updated in real-time */
  progress: Map<PreflightStep, PreflightStepResult>;
  /** Current step being tested */
  currentStep: PreflightStep | null;
  /** Final result (null until test completes) */
  result: PreflightResult | null;
  /** Clear results and progress for a fresh test */
  reset: () => void;
  /** Step metadata (labels, descriptions) */
  stepMeta: PreflightStepMeta[];
}

// ─── Hook implementation ───

export function usePreflightTest(): UsePreflightReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<Map<PreflightStep, PreflightStepResult>>(new Map());
  const [currentStep, setCurrentStep] = useState<PreflightStep | null>(null);
  const [result, setResult] = useState<PreflightResult | null>(null);
  const abortRef = useRef(false);

  const reset = useCallback(() => {
    setIsRunning(false);
    setProgress(new Map());
    setCurrentStep(null);
    setResult(null);
    abortRef.current = false;
  }, []);

  const runPreflight = useCallback(async (iceServers?: RTCIceServer[]): Promise<PreflightResult> => {
    // Reset state
    setIsRunning(true);
    setResult(null);
    setCurrentStep(null);
    abortRef.current = false;

    // Initialize all steps as pending
    const initialProgress = new Map<PreflightStep, PreflightStepResult>();
    for (const meta of PREFLIGHT_STEP_META) {
      initialProgress.set(meta.step, {
        step: meta.step,
        status: 'pending',
        message: 'Pendiente',
      });
    }
    setProgress(new Map(initialProgress));

    const preflightResult = await runPreflightTest(
      iceServers,
      (step: PreflightStep, status: PreflightStepStatus, message: string) => {
        if (abortRef.current) return;

        if (status === 'running') {
          setCurrentStep(step);
        }

        setProgress((prev) => {
          const next = new Map(prev);
          const existing = next.get(step);
          next.set(step, {
            step,
            status,
            message,
            detail: existing?.detail,
            durationMs: existing?.durationMs,
          });
          return next;
        });
      },
    );

    if (!abortRef.current) {
      // Update progress with full step results (including detail and durationMs)
      const finalProgress = new Map<PreflightStep, PreflightStepResult>();
      for (const stepResult of preflightResult.steps) {
        finalProgress.set(stepResult.step, stepResult);
      }
      setProgress(finalProgress);
      setResult(preflightResult);
      setCurrentStep(null);
      setIsRunning(false);
    }

    return preflightResult;
  }, []);

  return {
    runPreflight,
    isRunning,
    progress,
    currentStep,
    result,
    reset,
    stepMeta: PREFLIGHT_STEP_META,
  };
}
