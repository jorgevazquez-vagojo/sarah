import { useState, useCallback, useRef, useEffect } from 'react';
import { createSipClient, SipClient, SipConfig } from '../lib/sip-client';

export type CallState = 'idle' | 'registering' | 'registered' | 'calling' | 'ringing' | 'active' | 'ended';

export function useSIP(config?: SipConfig) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const clientRef = useRef<SipClient | null>(null);

  const register = useCallback(async () => {
    if (!config) return;
    const client = createSipClient(config);
    clientRef.current = client;
    client.onStateChange((state) => setCallState(state as CallState));
    setCallState('registering');
    await client.register();
  }, [config]);

  const call = useCallback((target: string) => {
    clientRef.current?.call(target);
  }, []);

  const hangup = useCallback(() => {
    clientRef.current?.hangup();
    setCallState('idle');
    setIsMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    clientRef.current?.mute(next);
    setIsMuted(next);
  }, [isMuted]);

  const destroy = useCallback(() => {
    clientRef.current?.destroy();
    clientRef.current = null;
    setCallState('idle');
  }, []);

  // Clean up SIP client on unmount
  useEffect(() => {
    return () => {
      clientRef.current?.destroy();
      clientRef.current = null;
    };
  }, []);

  return { callState, isMuted, register, call, hangup, toggleMute, destroy };
}
