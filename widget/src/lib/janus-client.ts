// Janus WebRTC Gateway — Lightweight WebSocket client for browser
// Implements the same SipClient interface as sip-client.ts
// Connects to Janus via WebSocket, registers SIP extension, makes calls

import { AudioQualityMonitor } from './audio-quality';
import type { SipClient } from './sip-client';

export interface JanusCallConfig {
  janusWsUrl: string;
  sipProxy: string;
  sipUser: string;
  sipPassword: string;
  targetUri: string;
  callId: string;
  iceServers?: RTCIceServer[];
}

const DEFAULT_ICE: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function createJanusClient(config: JanusCallConfig): SipClient {
  let stateHandler: ((state: string) => void) | null = null;
  let ws: WebSocket | null = null;
  let pc: RTCPeerConnection | null = null;
  let localStream: MediaStream | null = null;
  let remoteAudio: HTMLAudioElement | null = null;
  let destroyed = false;

  let sessionId: number = 0;
  let handleId: number = 0;
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  const qualityMonitor = new AudioQualityMonitor();
  const pendingTx = new Map<string, (data: any) => void>();

  let txCounter = 0;
  function newTx(): string {
    return `tx-${Date.now()}-${++txCounter}`;
  }

  function setState(state: string) {
    stateHandler?.(state);
  }

  function sendJanus(msg: Record<string, unknown>): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }
      const tx = newTx();
      const full = { ...msg, transaction: tx };
      pendingTx.set(tx, resolve);
      ws.send(JSON.stringify(full));

      // Timeout after 15s
      setTimeout(() => {
        if (pendingTx.has(tx)) {
          pendingTx.delete(tx);
          reject(new Error('Janus request timeout'));
        }
      }, 15000);
    });
  }

  function startKeepAlive() {
    keepAliveTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN && sessionId) {
        ws.send(JSON.stringify({
          janus: 'keepalive',
          session_id: sessionId,
          transaction: newTx(),
        }));
      }
    }, 25000);
  }

  function stopKeepAlive() {
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
  }

  // Create RTCPeerConnection for the call
  function createPeerConnection(): RTCPeerConnection {
    pc = new RTCPeerConnection({
      iceServers: config.iceServers || DEFAULT_ICE,
    });

    pc.onicecandidate = (e) => {
      if (e.candidate && ws?.readyState === WebSocket.OPEN && sessionId && handleId) {
        ws.send(JSON.stringify({
          janus: 'trickle',
          session_id: sessionId,
          handle_id: handleId,
          transaction: newTx(),
          candidate: e.candidate.toJSON(),
        }));
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (!pc) return;
      const s = pc.iceConnectionState;
      if (s === 'connected' || s === 'completed') {
        setState('active');
        qualityMonitor.start(pc!, localStream || undefined);
      } else if (s === 'disconnected' || s === 'failed') {
        qualityMonitor.stop();
        cleanup();
        setState('ended');
      }
    };

    pc.ontrack = (e) => {
      if (!remoteAudio) {
        remoteAudio = document.createElement('audio');
        remoteAudio.autoplay = true;
        remoteAudio.style.display = 'none';
        document.body.appendChild(remoteAudio);
      }
      remoteAudio.srcObject = e.streams[0] || new MediaStream([e.track]);
    };

    // Add local audio tracks
    if (localStream) {
      for (const track of localStream.getAudioTracks()) {
        pc.addTrack(track, localStream);
      }
    }

    return pc;
  }

  // Handle Janus events/messages
  function handleJanusMessage(data: any) {
    // Route transaction responses
    if (data.transaction && pendingTx.has(data.transaction)) {
      const resolve = pendingTx.get(data.transaction)!;
      pendingTx.delete(data.transaction);
      resolve(data);
    }

    // Handle SIP plugin events
    if (data.janus === 'event' && data.plugindata?.data) {
      const sipData = data.plugindata.data;
      const result = sipData.result;

      if (result) {
        switch (result.event) {
          case 'registered':
            setState('registered');
            break;

          case 'registration_failed':
            console.error('SIP registration failed:', result);
            cleanup();
            setState('ended');
            break;

          case 'calling':
            setState('calling');
            break;

          case 'ringing':
            setState('ringing');
            break;

          case 'accepted': {
            // Remote accepted — set remote SDP answer
            if (data.jsep && pc) {
              pc.setRemoteDescription(new RTCSessionDescription(data.jsep))
                .catch((e) => console.error('Failed to set remote SDP:', e));
            }
            setState('active');
            break;
          }

          case 'hangup':
          case 'declining':
            qualityMonitor.stop();
            cleanup();
            setState('ended');
            break;
        }
      }

      if (sipData.error) {
        console.error('SIP error:', sipData.error, sipData.error_code);
        qualityMonitor.stop();
        cleanup();
        setState('ended');
      }
    }

    // Handle media events with JSEP but no plugindata (mid-call)
    if (data.jsep && pc && !data.plugindata) {
      pc.setRemoteDescription(new RTCSessionDescription(data.jsep))
        .catch((e) => console.error('Failed to set remote SDP:', e));
    }
  }

  function cleanup() {
    stopKeepAlive();
    qualityMonitor.stop();

    if (pc) {
      pc.close();
      pc = null;
    }
    if (localStream) {
      for (const track of localStream.getTracks()) track.stop();
      localStream = null;
    }
    if (remoteAudio) {
      remoteAudio.srcObject = null;
      remoteAudio.remove();
      remoteAudio = null;
    }
    if (ws && ws.readyState <= WebSocket.OPEN) {
      // Try to destroy Janus session before closing
      if (sessionId) {
        try {
          ws.send(JSON.stringify({
            janus: 'destroy',
            session_id: sessionId,
            transaction: newTx(),
          }));
        } catch { /* ignore */ }
      }
      ws.close();
    }
    ws = null;
    sessionId = 0;
    handleId = 0;
    pendingTx.clear();
  }

  return {
    register: async () => {
      setState('registering');

      // 1. Get microphone access
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      } catch (e) {
        console.error('Microphone access denied:', e);
        setState('ended');
        throw e;
      }

      // 2. Connect to Janus WebSocket
      return new Promise<void>((resolve, reject) => {
        ws = new WebSocket(config.janusWsUrl, 'janus-protocol');

        ws.onopen = async () => {
          try {
            // 3. Create session
            const sessResp = await sendJanus({ janus: 'create' });
            if (sessResp.janus !== 'success') throw new Error('Session creation failed');
            sessionId = sessResp.data.id;

            startKeepAlive();

            // 4. Attach SIP plugin
            const attachResp = await sendJanus({
              janus: 'attach',
              session_id: sessionId,
              plugin: 'janus.plugin.sip',
            });
            if (attachResp.janus !== 'success') throw new Error('Plugin attach failed');
            handleId = attachResp.data.id;

            // 5. Register SIP extension
            await sendJanus({
              janus: 'message',
              session_id: sessionId,
              handle_id: handleId,
              body: {
                request: 'register',
                proxy: `sip:${config.sipProxy}`,
                username: `sip:${config.sipUser}@${config.sipProxy}`,
                authuser: config.sipUser,
                secret: config.sipPassword,
                display_name: 'Redegal WebPhone',
              },
            });

            // Registration result comes as async event, but we resolve now
            // and let handleJanusMessage update state to 'registered'
            resolve();
          } catch (e) {
            console.error('Janus setup failed:', e);
            cleanup();
            setState('ended');
            reject(e);
          }
        };

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            handleJanusMessage(data);
          } catch { /* ignore parse errors */ }
        };

        ws.onclose = () => {
          if (!destroyed) {
            qualityMonitor.stop();
            cleanup();
            setState('ended');
          }
        };

        ws.onerror = () => {
          ws?.close();
          reject(new Error('Janus WebSocket connection failed'));
        };
      });
    },

    call: (_target: string) => {
      if (!pc) createPeerConnection();

      // Create SDP offer and send INVITE via Janus SIP plugin
      pc!.createOffer().then(async (offer) => {
        await pc!.setLocalDescription(offer);

        // Send trickle complete + INVITE
        await sendJanus({
          janus: 'message',
          session_id: sessionId,
          handle_id: handleId,
          body: {
            request: 'call',
            uri: config.targetUri,
            autoaccept_reinvites: true,
          },
          jsep: {
            type: offer.type,
            sdp: offer.sdp,
          },
        });

        setState('calling');
      }).catch((e) => {
        console.error('Failed to create offer:', e);
        qualityMonitor.stop();
        cleanup();
        setState('ended');
      });
    },

    hangup: () => {
      // Send SIP BYE via Janus
      if (ws?.readyState === WebSocket.OPEN && sessionId && handleId) {
        try {
          ws.send(JSON.stringify({
            janus: 'message',
            session_id: sessionId,
            handle_id: handleId,
            transaction: newTx(),
            body: { request: 'hangup' },
          }));
        } catch { /* ignore */ }
      }

      qualityMonitor.stop();
      cleanup();
      setState('idle');
    },

    mute: (muted: boolean) => {
      if (localStream) {
        for (const track of localStream.getAudioTracks()) {
          track.enabled = !muted;
        }
      }
    },

    onStateChange: (handler) => {
      stateHandler = handler;
    },

    destroy: () => {
      destroyed = true;
      qualityMonitor.stop();
      cleanup();
      stateHandler = null;
    },

    getQualityMonitor: () => qualityMonitor,
  };
}
