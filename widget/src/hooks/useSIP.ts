import { useState, useCallback, useRef, useEffect } from 'react';
import { createSipClient, SipClient, SipConfig } from '../lib/sip-client';
import { createJanusClient, JanusCallConfig } from '../lib/janus-client';
import { AudioQualityMonitor } from '../lib/audio-quality';

export type CallState = 'idle' | 'registering' | 'registered' | 'calling' | 'ringing' | 'active' | 'ended';

export function useSIP() {
  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [qualityMonitor, setQualityMonitor] = useState<AudioQualityMonitor | null>(null);
  const clientRef = useRef<SipClient | null>(null);

  // Start a call — auto-detects mode from config type
  const startCall = useCallback(async (config: SipConfig | JanusCallConfig) => {
    // Destroy previous client if any
    if (clientRef.current) {
      clientRef.current.destroy();
      clientRef.current = null;
    }

    // Detect mode: JanusCallConfig has janusWsUrl, SipConfig has wssUrl
    const client = 'janusWsUrl' in config
      ? createJanusClient(config as JanusCallConfig)
      : createSipClient(config as SipConfig);

    clientRef.current = client;
    client.onStateChange((state) => setCallState(state as CallState));

    // Expose the quality monitor from the client
    setQualityMonitor(client.getQualityMonitor());

    try {
      await client.register();
      client.call('agent');
    } catch {
      setCallState('ended');
    }
  }, []);

  const hangup = useCallback(() => {
    clientRef.current?.hangup();
    clientRef.current?.destroy();
    clientRef.current = null;
    setCallState('idle');
    setIsMuted(false);
    setQualityMonitor(null);
  }, []);

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    clientRef.current?.mute(next);
    setIsMuted(next);
  }, [isMuted]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clientRef.current?.destroy();
      clientRef.current = null;
    };
  }, []);

  return { callState, isMuted, startCall, hangup, toggleMute, qualityMonitor };
}
