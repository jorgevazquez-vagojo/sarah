import React, { useState, useEffect } from 'react';
import { useChat } from './hooks/useChat';
import { useLanguage } from './hooks/useLanguage';
import { useSIP } from './hooks/useSIP';
import { FloatingButton } from './components/FloatingButton';
import { LanguageSelector } from './components/LanguageSelector';
import { BusinessLineChips } from './components/BusinessLineChips';
import { ChatPanel } from './components/ChatPanel';
import { CallPanel } from './components/CallPanel';
import { LeadForm } from './components/LeadForm';
import { EscalationBanner } from './components/EscalationBanner';

interface WidgetConfig {
  baseUrl?: string;
  apiUrl?: string;
  language?: string;
  primaryColor?: string;
}

function getVisitorId(): string {
  const key = 'redegal_visitor_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function Widget({ baseUrl = '', apiUrl, language: initialLang = 'auto', primaryColor = '#E30613' }: WidgetConfig) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'call' | 'lead_form' | 'offline_form' | 'csat'>('chat');
  const [showLineChips, setShowLineChips] = useState(true);
  const [agentName, setAgentName] = useState<string | null>(null);

  const visitorId = getVisitorId();
  const wsUrl = apiUrl || `${baseUrl.replace(/^http/, 'ws').replace(/\/widget$/, '')}/ws/chat`;

  const chat = useChat({ apiUrl: wsUrl, visitorId });
  const { t } = useLanguage(chat.language);
  const sip = useSIP();

  // Auto-show offline form outside business hours
  useEffect(() => {
    if (!chat.isBusinessHours && isOpen && chat.messages.length === 0) {
      setView('offline_form');
    }
  }, [chat.isBusinessHours, isOpen, chat.messages.length]);

  const handleToggle = () => setIsOpen((prev) => !prev);

  const handleSelectLine = (line: string) => {
    chat.setBusinessLine(line);
    setShowLineChips(false);
  };

  const handleSendMessage = (content: string) => {
    chat.sendMessage(content);
    setShowLineChips(false);
  };

  return (
    <>
      <FloatingButton isOpen={isOpen} onClick={handleToggle} primaryColor={primaryColor} />

      {isOpen && (
        <div className="rc-fixed rc-bottom-24 rc-right-5 rc-w-[380px] rc-max-h-[600px] rc-bg-white rc-rounded-2xl rc-shadow-2xl rc-flex rc-flex-col rc-overflow-hidden rc-border rc-border-gray-200 rc-z-50"
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
        >
          {/* Header */}
          <div className="rc-px-4 rc-py-3 rc-text-white rc-flex rc-items-center rc-justify-between" style={{ backgroundColor: primaryColor }}>
            <div>
              <h3 className="rc-font-semibold rc-text-sm rc-m-0">Redegal</h3>
              <p className="rc-text-xs rc-opacity-80 rc-m-0">
                {chat.isBusinessHours ? 'Online' : t('offline_title')}
              </p>
            </div>
            <button
              onClick={handleToggle}
              className="rc-bg-transparent rc-border-0 rc-text-white rc-cursor-pointer rc-opacity-80 hover:rc-opacity-100"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <LanguageSelector current={chat.language} onChange={chat.setLanguage} />

          {agentName && <EscalationBanner agentName={agentName} primaryColor={primaryColor} />}

          {/* Body */}
          <div className="rc-flex-1 rc-min-h-0 rc-flex rc-flex-col">
            {view === 'offline_form' ? (
              <div className="rc-p-4">
                <p className="rc-text-sm rc-text-gray-600 rc-mb-3">{t('offline_message')}</p>
                <LeadForm
                  language={chat.language}
                  primaryColor={primaryColor}
                  onSubmit={(data) => {
                    chat.submitOfflineForm({ ...data, language: chat.language });
                  }}
                />
              </div>
            ) : view === 'call' ? (
              <CallPanel
                language={chat.language}
                callState={sip.callState}
                isMuted={sip.isMuted}
                onHangup={() => { sip.hangup(); setView('chat'); }}
                onToggleMute={sip.toggleMute}
                primaryColor={primaryColor}
              />
            ) : view === 'lead_form' ? (
              <LeadForm
                language={chat.language}
                primaryColor={primaryColor}
                onSubmit={(data) => {
                  chat.submitLead(data);
                  setView('chat');
                }}
              />
            ) : (
              <>
                {showLineChips && chat.messages.length === 0 && (
                  <BusinessLineChips language={chat.language} onSelect={handleSelectLine} />
                )}
                <ChatPanel
                  messages={chat.messages}
                  isTyping={chat.isTyping}
                  language={chat.language}
                  onSend={handleSendMessage}
                  onEscalate={chat.escalate}
                  onRequestCall={() => {
                    if (chat.isBusinessHours) {
                      chat.requestCall();
                      setView('call');
                    } else {
                      setView('offline_form');
                    }
                  }}
                  isBusinessHours={chat.isBusinessHours}
                  primaryColor={primaryColor}
                />
              </>
            )}
          </div>

          {/* Footer */}
          <div className="rc-text-center rc-py-1.5 rc-text-[10px] rc-text-gray-400 rc-border-t rc-border-gray-100">
            {t('powered')}
          </div>
        </div>
      )}
    </>
  );
}
