import React from 'react';

interface Props {
  isOpen: boolean;
  onClick: () => void;
  primaryColor: string;
  unreadCount?: number;
}

export function FloatingButton({ isOpen, onClick, primaryColor, unreadCount = 0 }: Props) {
  return (
    <button
      onClick={onClick}
      style={{ backgroundColor: primaryColor }}
      className="rc-fixed rc-bottom-5 rc-right-5 rc-w-14 rc-h-14 rc-rounded-full rc-shadow-lg rc-flex rc-items-center rc-justify-center rc-cursor-pointer rc-border-0 rc-transition-transform hover:rc-scale-110 rc-z-50"
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
    >
      {isOpen ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      ) : (
        <>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
          </svg>
          {unreadCount > 0 && (
            <span className="rc-absolute rc-top-0 rc-right-0 rc-bg-red-500 rc-text-white rc-text-xs rc-rounded-full rc-w-5 rc-h-5 rc-flex rc-items-center rc-justify-center">
              {unreadCount}
            </span>
          )}
        </>
      )}
    </button>
  );
}
