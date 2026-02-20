// WebRTC Click2Call client — real implementation using browser WebRTC API
// Signaling goes through /ws/sip WebSocket, audio flows peer-to-peer

export interface SipConfig {
  wssUrl: string;
  domain: string;
  extension: string;
  password: string;
}

export interface SipClient {
  register: () => Promise<void>;
  call: (target: string) => void;
  hangup: () => void;
  mute: (muted: boolean) => void;
  onStateChange: (handler: (state: string) => void) => void;
  destroy: () => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function createSipClient(config: SipConfig): SipClient {
  let stateHandler: ((state: string) => void) | null = null;
  let ws: WebSocket | null = null;
  let pc: RTCPeerConnection | null = null;
  let localStream: MediaStream | null = null;
  let remoteAudio: HTMLAudioElement | null = null;
  let destroyed = false;

  function setState(state: string) {
    stateHandler?.(state);
  }

  function sendSignal(type: string, data: Record<string, unknown> = {}) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, ...data }));
    }
  }

  function createPeerConnection() {
    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal('ice_candidate', { candidate: e.candidate.toJSON() });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (!pc) return;
      const s = pc.iceConnectionState;
      if (s === 'connected' || s === 'completed') {
        setState('active');
      } else if (s === 'disconnected' || s === 'failed') {
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

    if (localStream) {
      for (const track of localStream.getAudioTracks()) {
        pc.addTrack(track, localStream);
      }
    }

    return pc;
  }

  async function handleSignalingMessage(data: Record<string, any>) {
    switch (data.type) {
      case 'call_accepted': {
        setState('ringing');
        createPeerConnection();
        try {
          const offer = await pc!.createOffer();
          await pc!.setLocalDescription(offer);
          sendSignal('webrtc_offer', { sdp: offer.sdp });
        } catch (e) {
          console.error('Failed to create offer:', e);
          cleanup();
          setState('ended');
        }
        break;
      }

      case 'webrtc_answer': {
        if (pc && data.sdp) {
          try {
            await pc.setRemoteDescription(
              new RTCSessionDescription({ type: 'answer', sdp: data.sdp })
            );
          } catch (e) {
            console.error('Failed to set remote description:', e);
          }
        }
        break;
      }

      case 'ice_candidate': {
        if (pc && data.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) {
            console.error('Failed to add ICE candidate:', e);
          }
        }
        break;
      }

      case 'call_ended':
      case 'call_rejected': {
        cleanup();
        setState('ended');
        break;
      }

      case 'error': {
        console.error('Signaling error:', data.message);
        cleanup();
        setState('ended');
        break;
      }
    }
  }

  function connectSignaling() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${proto}//${host}/ws/sip?role=visitor&extension=${encodeURIComponent(config.extension)}&callId=${encodeURIComponent(config.password)}`;

    ws = new WebSocket(url);

    ws.onopen = () => {
      sendSignal('register', {
        extension: config.extension,
        callId: config.password,
      });
    };

    ws.onmessage = (e) => {
      try {
        handleSignalingMessage(JSON.parse(e.data));
      } catch {}
    };

    ws.onclose = () => {
      if (!destroyed) {
        cleanup();
        setState('ended');
      }
    };

    ws.onerror = () => ws?.close();
  }

  function cleanup() {
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
      sendSignal('hangup');
      ws.close();
    }
    ws = null;
  }

  return {
    register: async () => {
      setState('registering');
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        connectSignaling();
        setState('registered');
      } catch (e) {
        console.error('Microphone access denied:', e);
        setState('ended');
        throw e;
      }
    },

    call: (_target: string) => {
      setState('calling');
      sendSignal('start_call');
    },

    hangup: () => {
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
      cleanup();
      stateHandler = null;
    },
  };
}
