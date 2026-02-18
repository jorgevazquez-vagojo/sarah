import React, { useRef, useEffect, useState } from 'react';
import { ChatMessage } from '../hooks/useChat';
import { useLanguage } from '../hooks/useLanguage';

interface Props {
  messages: ChatMessage[];
  isTyping: boolean;
  language: string;
  onSend: (content: string) => void;
  onEscalate: () => void;
  onRequestCall: () => void;
  isBusinessHours: boolean;
  primaryColor: string;
}

export function ChatPanel({
  messages, isTyping, language, onSend, onEscalate, onRequestCall, isBusinessHours, primaryColor,
}: Props) {
  const { t } = useLanguage(language);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput('');
  };

  return (
    <div className="rc-flex rc-flex-col rc-h-full">
      {/* Messages */}
      <div className="rc-flex-1 rc-overflow-y-auto rc-px-4 rc-py-3 rc-space-y-3">
        {messages.length === 0 && (
          <div className="rc-text-center rc-py-6">
            <div className="rc-w-12 rc-h-12 rc-mx-auto rc-mb-3 rc-rounded-full rc-flex rc-items-center rc-justify-center" style={{ backgroundColor: primaryColor + '15' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill={primaryColor}>
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
              </svg>
            </div>
            <p className="rc-text-sm rc-text-gray-600">{t('greeting')}</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`rc-flex ${msg.sender === 'visitor' ? 'rc-justify-end' : 'rc-justify-start'}`}>
            <div
              className={`rc-max-w-[80%] rc-px-3 rc-py-2 rc-rounded-2xl rc-text-sm rc-leading-relaxed ${
                msg.sender === 'visitor'
                  ? 'rc-text-white rc-rounded-br-sm'
                  : msg.sender === 'system'
                  ? 'rc-bg-gray-100 rc-text-gray-600 rc-italic rc-rounded-bl-sm'
                  : 'rc-bg-gray-100 rc-text-gray-800 rc-rounded-bl-sm'
              }`}
              style={msg.sender === 'visitor' ? { backgroundColor: primaryColor } : undefined}
            >
              {msg.agentName && (
                <span className="rc-text-xs rc-font-semibold rc-block rc-mb-0.5" style={{ color: primaryColor }}>
                  {msg.agentName}
                </span>
              )}
              {msg.content}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="rc-flex rc-justify-start">
            <div className="rc-bg-gray-100 rc-px-4 rc-py-2 rc-rounded-2xl rc-rounded-bl-sm">
              <div className="rc-flex rc-gap-1">
                <span className="rc-w-2 rc-h-2 rc-bg-gray-400 rc-rounded-full rc-animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="rc-w-2 rc-h-2 rc-bg-gray-400 rc-rounded-full rc-animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="rc-w-2 rc-h-2 rc-bg-gray-400 rc-rounded-full rc-animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Actions bar */}
      <div className="rc-flex rc-gap-2 rc-px-4 rc-py-1.5 rc-border-t rc-border-gray-100">
        <button
          onClick={onEscalate}
          className="rc-text-xs rc-px-2 rc-py-1 rc-rounded rc-border rc-border-gray-200 rc-bg-white hover:rc-bg-gray-50 rc-cursor-pointer rc-transition-colors"
        >
          {t('escalate')}
        </button>
        {isBusinessHours && (
          <button
            onClick={onRequestCall}
            className="rc-text-xs rc-px-2 rc-py-1 rc-rounded rc-border rc-border-gray-200 rc-bg-white hover:rc-bg-gray-50 rc-cursor-pointer rc-transition-colors"
          >
            {t('call')}
          </button>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="rc-flex rc-gap-2 rc-p-3 rc-border-t rc-border-gray-200">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('placeholder')}
          className="rc-flex-1 rc-px-3 rc-py-2 rc-border rc-border-gray-200 rc-rounded-full rc-text-sm rc-outline-none focus:rc-border-gray-400"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="rc-w-9 rc-h-9 rc-rounded-full rc-border-0 rc-text-white rc-flex rc-items-center rc-justify-center rc-cursor-pointer disabled:rc-opacity-40"
          style={{ backgroundColor: primaryColor }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
