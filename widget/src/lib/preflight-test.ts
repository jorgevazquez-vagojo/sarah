// ─── WebRTC Preflight Connectivity Test ───
// Twilio-grade diagnostic: browser → microphone → ICE/STUN → quality → codec
// Runs 5 steps sequentially with real-time progress, ~3-5s total
//
// ═══════════════════════════════════════════════════════════════
//  INTEGRATION INTO Widget.tsx — CallView component
// ═══════════════════════════════════════════════════════════════
//
//  1. Import the hook:
//
//     import { usePreflightTest, PreflightUI } from './hooks/usePreflightTest';
//
//  2. Inside CallView (or parent), add the hook:
//
//     const preflight = usePreflightTest();
//
//  3. Recommended UX flow:
//
//     A) User clicks "Call" button (or navigates to call view)
//     B) If preflight has NOT run recently (< 5 min), show PreflightUI
//     C) preflight.runPreflight(ICE_SERVERS) runs automatically
//     D) If result.canUseWebRTC → proceed to SIP registration + call
//     E) If result.overall === 'warning' → show warning + "Proceed anyway" + "Use callback"
//     F) If result.overall === 'failed' → show error + "Use phone callback instead"
//
//  4. Quick check (for returning users with cached result):
//
//     const quickOk = await runQuickCheck();
//     if (quickOk.webrtcOk && quickOk.micOk) { /* skip full test */ }
//
//  5. CSS class names (rc- prefix):
//
//     .rc-preflight              — outer container
//     .rc-preflight-step         — each step row
//     .rc-preflight-icon         — status icon (checkmark/spinner/X)
//     .rc-preflight-label        — step name
//     .rc-preflight-status       — status text (timing, result)
//     .rc-preflight-result       — overall result banner
//     .rc-preflight-actions      — action buttons (proceed / callback)
//     .rc-fade-in, .rc-slide-up  — existing widget animations
//
// ═══════════════════════════════════════════════════════════════

import { calculateMOS, mosToSignal } from './audio-quality';

// ─── Types ───

export type PreflightStep = 'browser' | 'microphone' | 'network' | 'quality' | 'codec';
export type PreflightStepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'warning';
export type PreflightOverall = 'testing' | 'passed' | 'warning' | 'failed';

export interface PreflightStepResult {
  step: PreflightStep;
  status: PreflightStepStatus;
  message: string;
  detail?: string;
  durationMs?: number;
}

export interface PreflightResult {
  overall: PreflightOverall;
  steps: PreflightStepResult[];
  recommendation: string;
  canUseWebRTC: boolean;
  networkQuality?: 'excellent' | 'good' | 'fair' | 'poor';
  estimatedMOS?: number;
  timestamp: number;
}

export type PreflightProgressCallback = (
  step: PreflightStep,
  status: PreflightStepStatus,
  message: string,
) => void;

// ─── Constants ───

const STEP_ORDER: PreflightStep[] = ['browser', 'microphone', 'network', 'quality', 'codec'];

/** Cache duration in milliseconds (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** ICE gathering timeout */
const ICE_GATHER_TIMEOUT_MS = 5000;

/** Audio level sampling duration */
const MIC_SAMPLE_DURATION_MS = 500;

/** Default STUN servers (same as sip-client.ts) */
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// ─── Cache ───

let cachedResult: PreflightResult | null = null;

function getCachedResult(): PreflightResult | null {
  if (!cachedResult) return null;
  if (Date.now() - cachedResult.timestamp > CACHE_TTL_MS) {
    cachedResult = null;
    return null;
  }
  return cachedResult;
}

/** Clear the cached preflight result (useful for manual re-test) */
export function clearPreflightCache(): void {
  cachedResult = null;
}

// ─── Utility ───

function detectBrowser(): { name: string; version: string } {
  const ua = navigator.userAgent;
  let name = 'Unknown';
  let version = '';

  if (ua.includes('Firefox/')) {
    name = 'Firefox';
    version = ua.match(/Firefox\/([\d.]+)/)?.[1] ?? '';
  } else if (ua.includes('Edg/')) {
    name = 'Edge';
    version = ua.match(/Edg\/([\d.]+)/)?.[1] ?? '';
  } else if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
    name = 'Chrome';
    version = ua.match(/Chrome\/([\d.]+)/)?.[1] ?? '';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    name = 'Safari';
    version = ua.match(/Version\/([\d.]+)/)?.[1] ?? '';
  }

  return { name, version };
}

function classifyNetworkQuality(rtt: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (rtt <= 50) return 'excellent';
  if (rtt <= 150) return 'good';
  if (rtt <= 300) return 'fair';
  return 'poor';
}

// ─── Step 1: Browser Compatibility ───

async function testBrowserCompat(): Promise<PreflightStepResult> {
  const start = performance.now();
  const browser = detectBrowser();

  // Check RTCPeerConnection
  if (typeof RTCPeerConnection === 'undefined') {
    return {
      step: 'browser',
      status: 'failed',
      message: 'WebRTC no soportado',
      detail: `${browser.name} ${browser.version} no dispone de RTCPeerConnection`,
      durationMs: Math.round(performance.now() - start),
    };
  }

  // Check getUserMedia
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      step: 'browser',
      status: 'failed',
      message: 'Acceso a medios no disponible',
      detail: `${browser.name} ${browser.version} no soporta getUserMedia`,
      durationMs: Math.round(performance.now() - start),
    };
  }

  // Check AudioContext (needed for audio level analysis)
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    return {
      step: 'browser',
      status: 'warning',
      message: 'AudioContext no disponible',
      detail: `${browser.name} ${browser.version}: calidad de audio no se puede verificar`,
      durationMs: Math.round(performance.now() - start),
    };
  }

  return {
    step: 'browser',
    status: 'passed',
    message: 'Navegador compatible',
    detail: `${browser.name} ${browser.version} — WebRTC, getUserMedia, AudioContext OK`,
    durationMs: Math.round(performance.now() - start),
  };
}

// ─── Step 2: Microphone Access ───

async function testMicrophone(): Promise<PreflightStepResult> {
  const start = performance.now();
  let stream: MediaStream | null = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      return {
        step: 'microphone',
        status: 'failed',
        message: 'No se detecta microfono',
        detail: 'getUserMedia devolvio un stream sin pista de audio',
        durationMs: Math.round(performance.now() - start),
      };
    }

    // Measure audio level for MIC_SAMPLE_DURATION_MS to confirm mic is actually capturing
    const hasAudio = await measureAudioLevel(stream, MIC_SAMPLE_DURATION_MS);
    const elapsed = Math.round(performance.now() - start);

    if (hasAudio) {
      return {
        step: 'microphone',
        status: 'passed',
        message: 'Microfono funcionando',
        detail: `Pista: ${audioTrack.label || 'Default'} — audio detectado`,
        durationMs: elapsed,
      };
    } else {
      // Mic access granted but no audio detected — could be muted or hardware issue
      return {
        step: 'microphone',
        status: 'warning',
        message: 'Microfono accesible, sin audio',
        detail: `Pista: ${audioTrack.label || 'Default'} — no se detecto volumen. Comprueba que el microfono no este silenciado.`,
        durationMs: elapsed,
      };
    }
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - start);

    if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
      return {
        step: 'microphone',
        status: 'failed',
        message: 'Permiso de microfono denegado',
        detail: 'Permite el acceso al microfono en la configuracion del navegador',
        durationMs: elapsed,
      };
    }

    if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
      return {
        step: 'microphone',
        status: 'failed',
        message: 'No se encontro microfono',
        detail: 'Conecta un microfono y vuelve a intentarlo',
        durationMs: elapsed,
      };
    }

    return {
      step: 'microphone',
      status: 'failed',
      message: 'Error al acceder al microfono',
      detail: err?.message || 'Error desconocido',
      durationMs: elapsed,
    };
  } finally {
    // Always release the stream
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
  }
}

/**
 * Measures audio level from a MediaStream using Web Audio API.
 * Returns true if any audio activity is detected above a threshold.
 */
async function measureAudioLevel(stream: MediaStream, durationMs: number): Promise<boolean> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return true; // Can't verify, assume OK

  let audioCtx: AudioContext | null = null;
  try {
    audioCtx = new AudioCtx();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const threshold = 5; // Minimum level to consider "audio present"
    const checkInterval = 50; // ms between checks
    const checks = Math.floor(durationMs / checkInterval);

    for (let i = 0; i < checks; i++) {
      analyser.getByteFrequencyData(dataArray);
      const maxLevel = Math.max(...Array.from(dataArray));
      if (maxLevel > threshold) {
        return true;
      }
      await sleep(checkInterval);
    }

    return false;
  } catch {
    // If AudioContext fails, assume mic is OK (permission was granted)
    return true;
  } finally {
    if (audioCtx && audioCtx.state !== 'closed') {
      try { await audioCtx.close(); } catch { /* ignore */ }
    }
  }
}

// ─── Step 3: STUN/TURN Connectivity (ICE Gathering) ───

interface IceResult {
  hasHost: boolean;
  hasSrflx: boolean;
  hasRelay: boolean;
  candidateCount: number;
  timeToFirstCandidateMs: number;
  publicIP?: string;
}

async function testIceConnectivity(iceServers: RTCIceServer[]): Promise<PreflightStepResult> {
  const start = performance.now();
  let pc: RTCPeerConnection | null = null;

  try {
    pc = new RTCPeerConnection({ iceServers });

    const iceResult = await gatherICECandidates(pc, ICE_GATHER_TIMEOUT_MS);
    const elapsed = Math.round(performance.now() - start);

    // Clean up
    pc.close();
    pc = null;

    if (iceResult.candidateCount === 0) {
      return {
        step: 'network',
        status: 'failed',
        message: 'No se pudo conectar a la red',
        detail: 'No se obtuvieron candidatos ICE. Verifica tu conexion a Internet y que no haya firewall bloqueando.',
        durationMs: elapsed,
      };
    }

    if (!iceResult.hasSrflx && !iceResult.hasRelay) {
      // Only host candidates — might work on local network but no NAT traversal
      return {
        step: 'network',
        status: 'warning',
        message: 'Conectividad limitada',
        detail: `Solo candidatos locales (${iceResult.candidateCount}). STUN no respondio — puede haber problemas con firewall.`,
        durationMs: elapsed,
      };
    }

    const types: string[] = [];
    if (iceResult.hasHost) types.push('local');
    if (iceResult.hasSrflx) types.push('STUN');
    if (iceResult.hasRelay) types.push('TURN');

    return {
      step: 'network',
      status: 'passed',
      message: 'Conectividad de red verificada',
      detail: `${iceResult.candidateCount} candidatos (${types.join(' + ')}) — primer candidato en ${iceResult.timeToFirstCandidateMs}ms`,
      durationMs: elapsed,
    };
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - start);
    return {
      step: 'network',
      status: 'failed',
      message: 'Error en prueba de red',
      detail: err?.message || 'Error desconocido al crear RTCPeerConnection',
      durationMs: elapsed,
    };
  } finally {
    if (pc) {
      try { pc.close(); } catch { /* ignore */ }
    }
  }
}

/**
 * Creates a data channel and gathers ICE candidates.
 * Returns information about the types and timing of candidates received.
 */
function gatherICECandidates(pc: RTCPeerConnection, timeoutMs: number): Promise<IceResult> {
  return new Promise(async (resolve) => {
    const result: IceResult = {
      hasHost: false,
      hasSrflx: false,
      hasRelay: false,
      candidateCount: 0,
      timeToFirstCandidateMs: 0,
    };

    const gatherStart = performance.now();
    let firstCandidateTime = 0;
    let resolved = false;

    function finish() {
      if (resolved) return;
      resolved = true;
      result.timeToFirstCandidateMs = Math.round(firstCandidateTime || (performance.now() - gatherStart));
      resolve(result);
    }

    // Timeout safety
    const timer = setTimeout(finish, timeoutMs);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        result.candidateCount++;

        if (firstCandidateTime === 0) {
          firstCandidateTime = performance.now() - gatherStart;
        }

        const candidateType = event.candidate.type;
        if (candidateType === 'host') result.hasHost = true;
        if (candidateType === 'srflx') result.hasSrflx = true;
        if (candidateType === 'relay') result.hasRelay = true;

        // Extract public IP from srflx candidate
        if (candidateType === 'srflx' && event.candidate.address) {
          result.publicIP = event.candidate.address;
        }
      } else {
        // null candidate = gathering complete
        clearTimeout(timer);
        finish();
      }
    };

    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timer);
        finish();
      }
    };

    // Create a data channel to trigger ICE gathering
    pc.createDataChannel('preflight-test');

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
    } catch {
      clearTimeout(timer);
      finish();
    }
  });
}

// ─── Step 4: Network Quality Estimation ───

async function testNetworkQuality(iceServers: RTCIceServer[]): Promise<PreflightStepResult & { quality?: 'excellent' | 'good' | 'fair' | 'poor'; estimatedMOS?: number }> {
  const start = performance.now();
  let pc1: RTCPeerConnection | null = null;
  let pc2: RTCPeerConnection | null = null;

  try {
    // Create a loopback connection to measure RTT via ICE candidate pair stats
    pc1 = new RTCPeerConnection({ iceServers });
    pc2 = new RTCPeerConnection({ iceServers });

    // Wire ICE candidates between the two peers
    pc1.onicecandidate = (e) => {
      if (e.candidate) pc2!.addIceCandidate(e.candidate).catch(() => {});
    };
    pc2.onicecandidate = (e) => {
      if (e.candidate) pc1!.addIceCandidate(e.candidate).catch(() => {});
    };

    // Create a data channel for the connection
    const dc = pc1.createDataChannel('quality-test');

    // Create offer/answer
    const offer = await pc1.createOffer();
    await pc1.setLocalDescription(offer);
    await pc2.setRemoteDescription(offer);

    const answer = await pc2.createAnswer();
    await pc2.setLocalDescription(answer);
    await pc1.setRemoteDescription(answer);

    // Wait for connection to establish
    const connected = await waitForIceConnected(pc1, 4000);

    if (!connected) {
      const elapsed = Math.round(performance.now() - start);
      return {
        step: 'quality',
        status: 'warning',
        message: 'No se pudo medir la calidad',
        detail: 'La conexion de prueba no se establecio a tiempo',
        durationMs: elapsed,
      };
    }

    // Give it a moment for stats to stabilize
    await sleep(300);

    // Get stats from the connected pair
    const stats = await pc1.getStats();
    let rtt = 0;
    let localCandidateType = '';

    stats.forEach((report: any) => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        if (typeof report.currentRoundTripTime === 'number') {
          rtt = report.currentRoundTripTime * 1000; // s to ms
        }
      }
      if (report.type === 'local-candidate') {
        localCandidateType = report.candidateType || '';
      }
    });

    // Close data channel
    dc.close();

    // For loopback, RTT will be very low. Adjust estimate based on candidate type.
    // If we got srflx candidates, the RTT includes STUN server round-trip.
    // Use a conservative estimate: actual call RTT ~ 2x loopback for real-world.
    const estimatedRealRtt = rtt > 0 ? Math.max(rtt * 2, 20) : 50; // minimum 20ms for realism
    const estimatedJitter = estimatedRealRtt * 0.1; // rough estimate
    const estimatedLoss = 0; // loopback has no loss

    const quality = classifyNetworkQuality(estimatedRealRtt);
    const mos = calculateMOS(estimatedRealRtt, estimatedJitter, estimatedLoss);
    const elapsed = Math.round(performance.now() - start);

    const qualityLabels: Record<string, string> = {
      excellent: 'Excelente',
      good: 'Buena',
      fair: 'Aceptable',
      poor: 'Deficiente',
    };

    if (quality === 'poor') {
      return {
        step: 'quality',
        status: 'warning',
        message: `Calidad de red: ${qualityLabels[quality]}`,
        detail: `RTT estimado: ${Math.round(estimatedRealRtt)}ms — MOS: ${mos}/5.0. La llamada puede tener cortes.`,
        durationMs: elapsed,
        quality,
        estimatedMOS: mos,
      };
    }

    return {
      step: 'quality',
      status: 'passed',
      message: `Calidad de red: ${qualityLabels[quality]}`,
      detail: `RTT estimado: ${Math.round(estimatedRealRtt)}ms — MOS: ${mos}/5.0`,
      durationMs: elapsed,
      quality,
      estimatedMOS: mos,
    };
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - start);
    // Non-fatal: quality estimation is supplementary
    return {
      step: 'quality',
      status: 'warning',
      message: 'Estimacion de calidad no disponible',
      detail: err?.message || 'Error en prueba de calidad de red',
      durationMs: elapsed,
    };
  } finally {
    if (pc1) { try { pc1.close(); } catch { /* ignore */ } }
    if (pc2) { try { pc2.close(); } catch { /* ignore */ } }
  }
}

/**
 * Waits for a peer connection to reach 'connected' or 'completed' state.
 */
function waitForIceConnected(pc: RTCPeerConnection, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
      resolve(true);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;

    const handler = () => {
      const state = pc.iceConnectionState;
      if (state === 'connected' || state === 'completed') {
        if (timer) clearTimeout(timer);
        pc.removeEventListener('iceconnectionstatechange', handler);
        resolve(true);
      } else if (state === 'failed' || state === 'closed') {
        if (timer) clearTimeout(timer);
        pc.removeEventListener('iceconnectionstatechange', handler);
        resolve(false);
      }
    };

    pc.addEventListener('iceconnectionstatechange', handler);

    timer = setTimeout(() => {
      pc.removeEventListener('iceconnectionstatechange', handler);
      resolve(false);
    }, timeoutMs);
  });
}

// ─── Step 5: Codec Verification ───

async function testCodecs(): Promise<PreflightStepResult> {
  const start = performance.now();

  try {
    // Check Opus codec support via RTCRtpSender.getCapabilities (modern browsers)
    const senderCaps = RTCRtpSender.getCapabilities?.('audio');
    const receiverCaps = RTCRtpReceiver.getCapabilities?.('audio');

    const hasOpusSend = senderCaps?.codecs?.some(
      (c) => c.mimeType.toLowerCase() === 'audio/opus'
    ) ?? false;

    const hasOpusRecv = receiverCaps?.codecs?.some(
      (c) => c.mimeType.toLowerCase() === 'audio/opus'
    ) ?? false;

    const elapsed = Math.round(performance.now() - start);

    if (hasOpusSend && hasOpusRecv) {
      const allCodecs = senderCaps?.codecs
        ?.filter((c) => c.mimeType.startsWith('audio/'))
        .map((c) => c.mimeType.replace('audio/', ''))
        ?? [];
      const uniqueCodecs = [...new Set(allCodecs)];

      return {
        step: 'codec',
        status: 'passed',
        message: 'Codec Opus verificado',
        detail: `Codecs disponibles: ${uniqueCodecs.join(', ')}`,
        durationMs: elapsed,
      };
    }

    if (!senderCaps && !receiverCaps) {
      // Older browser — getCapabilities not available. Try SDP-based check.
      const opusInSdp = await checkOpusViaSDP();
      const sdpElapsed = Math.round(performance.now() - start);

      if (opusInSdp) {
        return {
          step: 'codec',
          status: 'passed',
          message: 'Codec Opus detectado (via SDP)',
          detail: 'getCapabilities no disponible, verificado mediante offer SDP',
          durationMs: sdpElapsed,
        };
      }

      return {
        step: 'codec',
        status: 'warning',
        message: 'No se pudo verificar Opus',
        detail: 'El navegador no expone informacion de codecs. La llamada podria funcionar igualmente.',
        durationMs: sdpElapsed,
      };
    }

    return {
      step: 'codec',
      status: 'warning',
      message: 'Opus parcialmente disponible',
      detail: `Envio: ${hasOpusSend ? 'OK' : 'No'} — Recepcion: ${hasOpusRecv ? 'OK' : 'No'}`,
      durationMs: elapsed,
    };
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - start);
    return {
      step: 'codec',
      status: 'warning',
      message: 'Error verificando codecs',
      detail: err?.message || 'Error desconocido',
      durationMs: elapsed,
    };
  }
}

/**
 * Fallback: create a temporary PeerConnection and check if the SDP offer
 * contains Opus codec line (a=rtpmap:... opus/48000).
 */
async function checkOpusViaSDP(): Promise<boolean> {
  let pc: RTCPeerConnection | null = null;
  try {
    pc = new RTCPeerConnection();
    // Need to add a transceiver to generate audio SDP
    pc.addTransceiver('audio', { direction: 'sendrecv' });
    const offer = await pc.createOffer();
    const hasOpus = offer.sdp?.toLowerCase().includes('opus/48000') ?? false;
    return hasOpus;
  } catch {
    return false;
  } finally {
    if (pc) { try { pc.close(); } catch { /* ignore */ } }
  }
}

// ─── Main: Run Full Preflight Test ───

/**
 * Runs the complete 5-step WebRTC preflight connectivity test.
 *
 * @param iceServers - ICE server configuration (STUN/TURN). Defaults to Google STUN.
 * @param onProgress - Optional callback fired as each step starts and completes.
 * @returns Comprehensive preflight result with per-step details.
 */
export async function runPreflightTest(
  iceServers?: RTCIceServer[],
  onProgress?: PreflightProgressCallback,
): Promise<PreflightResult> {
  const servers = iceServers ?? DEFAULT_ICE_SERVERS;

  // Check cache first
  const cached = getCachedResult();
  if (cached) {
    // Fire progress for all steps as already passed (instant replay)
    if (onProgress) {
      for (const stepResult of cached.steps) {
        onProgress(stepResult.step, stepResult.status, stepResult.message);
      }
    }
    return cached;
  }

  const steps: PreflightStepResult[] = [];
  let networkQuality: 'excellent' | 'good' | 'fair' | 'poor' | undefined;
  let estimatedMOS: number | undefined;
  let hasCriticalFailure = false;
  let hasWarning = false;

  // Helper to run a step with progress reporting
  async function runStep(
    stepName: PreflightStep,
    testFn: () => Promise<PreflightStepResult & { quality?: string; estimatedMOS?: number }>,
  ): Promise<void> {
    onProgress?.(stepName, 'running', 'Comprobando...');

    const result = await testFn();
    steps.push(result);

    if (result.status === 'failed') hasCriticalFailure = true;
    if (result.status === 'warning') hasWarning = true;

    // Capture quality metrics from the quality step
    if (stepName === 'quality') {
      const qr = result as PreflightStepResult & { quality?: string; estimatedMOS?: number };
      if (qr.quality) networkQuality = qr.quality as any;
      if (qr.estimatedMOS) estimatedMOS = qr.estimatedMOS;
    }

    onProgress?.(stepName, result.status, result.message);
  }

  // Step 1: Browser
  await runStep('browser', testBrowserCompat);

  // If browser fails, skip remaining tests
  if (hasCriticalFailure) {
    // Fill remaining steps as skipped
    for (const step of STEP_ORDER.slice(1)) {
      const skipped: PreflightStepResult = {
        step,
        status: 'pending',
        message: 'Omitido (navegador no compatible)',
      };
      steps.push(skipped);
      onProgress?.(step, 'pending', skipped.message);
    }
  } else {
    // Step 2: Microphone
    await runStep('microphone', testMicrophone);

    // Step 3: Network (even if mic failed — user might fix mic later)
    await runStep('network', () => testIceConnectivity(servers));

    // Step 4: Quality (skip if network failed)
    const networkPassed = steps.find((s) => s.step === 'network')?.status !== 'failed';
    if (networkPassed) {
      await runStep('quality', () => testNetworkQuality(servers));
    } else {
      const skipped: PreflightStepResult = {
        step: 'quality',
        status: 'pending',
        message: 'Omitido (sin conexion de red)',
      };
      steps.push(skipped);
      onProgress?.('quality', 'pending', skipped.message);
    }

    // Step 5: Codec
    await runStep('codec', testCodecs);
  }

  // ─── Compute overall result ───

  const failedSteps = steps.filter((s) => s.status === 'failed');
  const warningSteps = steps.filter((s) => s.status === 'warning');

  // Critical failures that prevent WebRTC
  const criticalFailures = failedSteps.filter(
    (s) => s.step === 'browser' || s.step === 'microphone' || s.step === 'network'
  );

  let overall: PreflightOverall;
  let canUseWebRTC: boolean;
  let recommendation: string;

  if (criticalFailures.length > 0) {
    overall = 'failed';
    canUseWebRTC = false;

    if (criticalFailures.some((s) => s.step === 'browser')) {
      recommendation = 'Tu navegador no soporta llamadas WebRTC. Usa Chrome, Firefox, Edge o Safari actualizados, o solicita que te llamemos.';
    } else if (criticalFailures.some((s) => s.step === 'microphone')) {
      recommendation = 'No se pudo acceder al microfono. Permite el acceso en la configuracion del navegador, o solicita que te llamemos.';
    } else {
      recommendation = 'Tu red no permite conexiones WebRTC. Puede haber un firewall corporativo bloqueando. Solicita que te llamemos al telefono.';
    }
  } else if (warningSteps.length > 0 || networkQuality === 'poor') {
    overall = 'warning';
    canUseWebRTC = true;
    recommendation = 'Tu conexion puede tener problemas de calidad. Puedes intentar la llamada o solicitar que te llamemos.';
  } else {
    overall = 'passed';
    canUseWebRTC = true;
    recommendation = 'Todo listo. Tu conexion es adecuada para llamadas de voz.';
  }

  const result: PreflightResult = {
    overall,
    steps,
    recommendation,
    canUseWebRTC,
    networkQuality,
    estimatedMOS,
    timestamp: Date.now(),
  };

  // Cache the result
  cachedResult = result;

  return result;
}

// ─── Quick Check (returning users) ───

/**
 * Quick check (~1s): verifies browser WebRTC support and microphone permission.
 * Does NOT test network connectivity. Use for returning users who recently passed full test.
 */
export async function runQuickCheck(): Promise<{ micOk: boolean; webrtcOk: boolean }> {
  // WebRTC
  const webrtcOk =
    typeof RTCPeerConnection !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  if (!webrtcOk) {
    return { micOk: false, webrtcOk: false };
  }

  // Mic — quick permission check
  let micOk = false;
  try {
    // Try permissions API first (instant, no prompt)
    if (navigator.permissions?.query) {
      const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (perm.state === 'granted') {
        micOk = true;
      } else if (perm.state === 'denied') {
        micOk = false;
      } else {
        // 'prompt' — we'd need to actually request, which is slow for "quick" check
        // Return true optimistically (will be tested in full preflight)
        micOk = true;
      }
    } else {
      // Permissions API not available — assume OK if we've passed before
      micOk = getCachedResult()?.steps.find((s) => s.step === 'microphone')?.status === 'passed';
    }
  } catch {
    micOk = false;
  }

  return { micOk, webrtcOk };
}

// ─── Utility ───

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
