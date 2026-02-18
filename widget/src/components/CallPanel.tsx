import React from 'react';
import { CallState } from '../hooks/useSIP';
import { useLanguage } from '../hooks/useLanguage';

interface Props {
  language: string;
  callState: CallState;
  isMuted: boolean;
  onHangup: () => void;
  onToggleMute: () => void;
  primaryColor: string;
}

export function CallPanel({ language, callState, isMuted, onHangup, onToggleMute, primaryColor }: Props) {
  const { t } = useLanguage(language);

  const statusLabels: Record<CallState, string> = {
    idle: '',
    registering: 'Conectando...',
    registered: 'Listo',
    calling: t('call') + '...',
    ringing: 'Sonando...',
    active: 'En llamada',
    ended: t('call') + ' finalizada',
  };

  return (
    <div className="rc-flex rc-flex-col rc-items-center rc-justify-center rc-py-8 rc-px-4">
      {/* Status indicator */}
      <div
        className={`rc-w-20 rc-h-20 rc-rounded-full rc-flex rc-items-center rc-justify-center rc-mb-4 ${
          callState === 'active' ? 'rc-animate-pulse' : ''
        }`}
        style={{ backgroundColor: primaryColor + '20' }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill={primaryColor}>
          <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
        </svg>
      </div>

      <p className="rc-text-sm rc-text-gray-600 rc-mb-6">{statusLabels[callState]}</p>

      {/* Controls */}
      {(callState === 'active' || callState === 'calling' || callState === 'ringing') && (
        <div className="rc-flex rc-gap-4">
          <button
            onClick={onToggleMute}
            className={`rc-w-12 rc-h-12 rc-rounded-full rc-border-0 rc-cursor-pointer rc-flex rc-items-center rc-justify-center ${
              isMuted ? 'rc-bg-red-100 rc-text-red-600' : 'rc-bg-gray-100 rc-text-gray-600'
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              {isMuted ? (
                <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
              ) : (
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
              )}
            </svg>
          </button>

          <button
            onClick={onHangup}
            className="rc-w-12 rc-h-12 rc-rounded-full rc-bg-red-500 rc-text-white rc-border-0 rc-cursor-pointer rc-flex rc-items-center rc-justify-center hover:rc-bg-red-600"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
