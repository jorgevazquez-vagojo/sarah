// SIP.js wrapper — loaded dynamically only when VoIP is needed
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

// Placeholder — real implementation requires SIP.js library loaded in Phase 4
export function createSipClient(_config: SipConfig): SipClient {
  let stateHandler: ((state: string) => void) | null = null;

  return {
    register: async () => {
      stateHandler?.('registered');
    },
    call: (_target: string) => {
      stateHandler?.('calling');
    },
    hangup: () => {
      stateHandler?.('idle');
    },
    mute: (_muted: boolean) => {},
    onStateChange: (handler) => {
      stateHandler = handler;
    },
    destroy: () => {
      stateHandler = null;
    },
  };
}
