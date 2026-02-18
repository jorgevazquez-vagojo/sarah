import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useChat, ChatMessage } from './hooks/useChat';
import { useLanguage } from './hooks/useLanguage';
import { useSIP } from './hooks/useSIP';
import { ThemeConfig, WidgetView, RichContent } from './lib/types';
import { applyTheme, DEFAULT_THEME } from './lib/theme';
import { playSound } from './lib/sounds';

interface WidgetConfig {
  baseUrl?: string;
  apiUrl?: string;
  configUrl?: string;
  language?: string;
  primaryColor?: string;
  theme?: Partial<ThemeConfig>;
}

function getVisitorId(): string {
  const key = 'redegal_vid';
  let id = localStorage.getItem(key);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
  return id;
}

// ─── Language metadata ───
const LANG_META: Record<string, { label: string; flag: string; native: string }> = {
  es: { label: 'Español', flag: '🇪🇸', native: 'Español' },
  en: { label: 'English', flag: '🇬🇧', native: 'English' },
  pt: { label: 'Português', flag: '🇵🇹', native: 'Português' },
  fr: { label: 'Français', flag: '🇫🇷', native: 'Français' },
  de: { label: 'Deutsch', flag: '🇩🇪', native: 'Deutsch' },
  it: { label: 'Italiano', flag: '🇮🇹', native: 'Italiano' },
  nl: { label: 'Nederlands', flag: '🇳🇱', native: 'Nederlands' },
  zh: { label: '中文', flag: '🇨🇳', native: '中文' },
  ja: { label: '日本語', flag: '🇯🇵', native: '日本語' },
  ko: { label: '한국어', flag: '🇰🇷', native: '한국어' },
  ar: { label: 'العربية', flag: '🇸🇦', native: 'العربية' },
  gl: { label: 'Galego', flag: '🏴', native: 'Galego' },
};

// ─── Icons ───
const Icons = {
  chat: (c = 'white') => <svg width="28" height="28" viewBox="0 0 24 24" fill={c}><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>,
  close: (c = 'white') => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  send: (c = 'white') => <svg width="18" height="18" viewBox="0 0 24 24" fill={c}><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>,
  phone: (c = 'currentColor') => <svg width="18" height="18" viewBox="0 0 24 24" fill={c}><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>,
  agent: (c = 'currentColor') => <svg width="18" height="18" viewBox="0 0 24 24" fill={c}><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>,
  attach: (c = 'currentColor') => <svg width="18" height="18" viewBox="0 0 24 24" fill={c}><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>,
  sound: (c = 'currentColor') => <svg width="16" height="16" viewBox="0 0 24 24" fill={c}><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>,
  mute: (c = 'currentColor') => <svg width="16" height="16" viewBox="0 0 24 24" fill={c}><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>,
  star: (c = 'currentColor') => <svg width="24" height="24" viewBox="0 0 24 24" fill={c}><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>,
  minimize: (c = 'currentColor') => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
};

export function Widget(props: WidgetConfig) {
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<WidgetView>('welcome');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);

  const visitorId = getVisitorId();
  const wsUrl = props.apiUrl || `${(props.baseUrl || '').replace(/^http/, 'ws').replace(/\/widget$/, '')}/ws/chat`;
  const chat = useChat({ apiUrl: wsUrl, visitorId });
  const { t, isRTL } = useLanguage(chat.language, props.baseUrl?.replace('/widget', ''));
  const sip = useSIP();

  // Load remote theme
  useEffect(() => {
    if (props.configUrl) {
      fetch(props.configUrl).then(r => r.json()).then(cfg => {
        setTheme({ ...DEFAULT_THEME, ...cfg });
      }).catch(() => {});
    }
    if (props.theme) setTheme(prev => ({ ...prev, ...props.theme }));
    if (props.primaryColor) {
      setTheme(prev => ({ ...prev, colors: { ...prev.colors, primary: props.primaryColor!, gradientFrom: props.primaryColor!, gradientTo: props.primaryColor! } }));
    }
  }, [props.configUrl, props.primaryColor]);

  // Apply theme to DOM
  useEffect(() => {
    if (rootRef.current) applyTheme(theme, rootRef.current);
  }, [theme]);

  // Sound on new messages when minimized
  useEffect(() => {
    if (chat.messages.length > prevMsgCountRef.current && !isOpen && soundEnabled) {
      const last = chat.messages[chat.messages.length - 1];
      if (last.sender !== 'visitor') {
        setUnread(u => u + 1);
        playSound('notification');
      }
    }
    prevMsgCountRef.current = chat.messages.length;
  }, [chat.messages.length, isOpen, soundEnabled]);

  // Auto show offline form
  useEffect(() => {
    if (!chat.isBusinessHours && isOpen && view === 'welcome') setView('offline_form');
  }, [chat.isBusinessHours, isOpen, view]);

  const handleToggle = () => {
    setIsOpen(prev => !prev);
    if (!isOpen) setUnread(0);
  };

  // Expose API for external control
  useEffect(() => {
    (window as any).__redegalWidget = {
      open: () => { setIsOpen(true); setUnread(0); },
      close: () => setIsOpen(false),
      updateConfig: (cfg: any) => {
        if (cfg.primaryColor) setTheme(prev => ({ ...prev, colors: { ...prev.colors, primary: cfg.primaryColor, gradientFrom: cfg.primaryColor, gradientTo: cfg.primaryColor } }));
        if (cfg.language) chat.setLanguage(cfg.language);
        if (cfg.position) setTheme(prev => ({ ...prev, layout: { ...prev.layout, position: cfg.position } }));
      },
    };
  }, []);

  const { colors, layout, features, branding } = theme;
  const isLeft = layout.position === 'bottom-left';
  const headerBg = colors.headerGradient
    ? `linear-gradient(135deg, ${colors.gradientFrom}, ${colors.gradientTo})`
    : colors.primary;

  return (
    <div ref={rootRef} style={{ fontFamily: theme.typography.fontFamily, fontSize: theme.typography.fontSize, color: colors.text }} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ─── Floating Button ─── */}
      <button
        onClick={handleToggle}
        style={{
          position: 'fixed',
          [isLeft ? 'left' : 'right']: layout.offsetX,
          bottom: layout.offsetY,
          width: layout.buttonSize,
          height: layout.buttonSize,
          borderRadius: layout.buttonBorderRadius,
          background: headerBg,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          zIndex: layout.zIndex,
          transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s',
          transform: isOpen ? 'scale(0.9) rotate(90deg)' : 'scale(1)',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = isOpen ? 'scale(0.95) rotate(90deg)' : 'scale(1.1)')}
        onMouseLeave={e => (e.currentTarget.style.transform = isOpen ? 'scale(0.9) rotate(90deg)' : 'scale(1)')}
      >
        {isOpen ? Icons.close(colors.textOnPrimary) : Icons.chat(colors.textOnPrimary)}
        {unread > 0 && !isOpen && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: colors.error, color: 'white',
            fontSize: 11, fontWeight: 700, minWidth: 20, height: 20,
            borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 5px',
          }}>{unread}</span>
        )}
      </button>

      {/* ─── Panel ─── */}
      {isOpen && (
        <div
          className="rc-widget-panel rc-animate-fade-in"
          style={{
            position: 'fixed',
            [isLeft ? 'left' : 'right']: layout.offsetX,
            bottom: layout.offsetY + layout.buttonSize + 12,
            width: layout.width,
            maxHeight: layout.maxHeight,
            background: colors.background,
            borderRadius: layout.borderRadius,
            boxShadow: '0 8px 60px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: `1px solid ${colors.border}`,
            zIndex: layout.zIndex,
          }}
        >
          {/* ─── Header ─── */}
          <div style={{
            background: headerBg,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: layout.headerHeight,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {branding.logoUrl && (
                <img src={branding.logoUrl} alt="" style={{ height: 28, width: 'auto', borderRadius: 4 }} />
              )}
              <div>
                <div style={{ color: colors.textOnPrimary, fontWeight: 700, fontSize: theme.typography.headerFontSize }}>{branding.companyName}</div>
                <div style={{ color: colors.textOnPrimary, opacity: 0.75, fontSize: 11, marginTop: 1 }}>
                  {chat.isConnected
                    ? (chat.isBusinessHours ? '● Online' : t('offline_title'))
                    : t('reconnecting')}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {features.enableSoundNotifications && (
                <button onClick={() => setSoundEnabled(!soundEnabled)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '4px 6px', cursor: 'pointer', display: 'flex', color: colors.textOnPrimary }}>
                  {soundEnabled ? Icons.sound(colors.textOnPrimary) : Icons.mute(colors.textOnPrimary)}
                </button>
              )}
              {features.enableLanguageSelector && (
                <button onClick={() => setShowLangPicker(!showLangPicker)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: colors.textOnPrimary, fontWeight: 600 }}>
                  {LANG_META[chat.language]?.flag || '🌐'} {chat.language.toUpperCase()}
                </button>
              )}
              <button onClick={handleToggle} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '4px 6px', cursor: 'pointer', display: 'flex' }}>
                {Icons.minimize(colors.textOnPrimary)}
              </button>
            </div>
          </div>

          {/* ─── Language Picker (overlay) ─── */}
          {showLangPicker && (
            <div style={{ background: colors.surface, borderBottom: `1px solid ${colors.border}`, padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
              {theme.i18n.availableLanguages.map(l => {
                const meta = LANG_META[l];
                if (!meta) return null;
                return (
                  <button key={l} onClick={() => { chat.setLanguage(l); setShowLangPicker(false); }}
                    style={{
                      padding: '4px 10px', fontSize: 12, borderRadius: 8, cursor: 'pointer',
                      border: chat.language === l ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                      background: chat.language === l ? colors.primaryLight : colors.background,
                      fontWeight: chat.language === l ? 600 : 400, color: colors.text,
                    }}
                  >
                    {meta.flag} {meta.native}
                  </button>
                );
              })}
            </div>
          )}

          {/* ─── Body ─── */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {view === 'welcome' && chat.messages.length === 0 ? (
              <WelcomeView theme={theme} t={t} onStartChat={() => setView('chat')} onSelectLine={(l) => { chat.setBusinessLine(l); setView('chat'); }} />
            ) : view === 'offline_form' ? (
              <OfflineFormView theme={theme} t={t} onSubmit={(data) => { chat.submitOfflineForm({ ...data, language: chat.language }); }} />
            ) : view === 'csat' ? (
              <CsatView theme={theme} t={t} onSubmit={(r, c) => { chat.submitCsat(r, c); setView('chat'); }} />
            ) : view === 'call' ? (
              <CallView theme={theme} t={t} sip={sip} onBack={() => setView('chat')} />
            ) : (
              <ChatView
                theme={theme} t={t} messages={chat.messages} isTyping={chat.isTyping}
                onSend={chat.sendMessage} onEscalate={chat.escalate}
                onCall={() => { chat.isBusinessHours ? (chat.requestCall(), setView('call')) : setView('offline_form'); }}
                onCsat={() => setView('csat')}
                isBusinessHours={chat.isBusinessHours}
              />
            )}
          </div>

          {/* ─── Footer ─── */}
          {branding.showPoweredBy && (
            <div style={{ textAlign: 'center', padding: '6px 0', fontSize: 10, color: colors.textSecondary, borderTop: `1px solid ${colors.border}`, background: colors.surface }}>
              {branding.poweredByText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// Sub-views
// ─────────────────────────────────────────────────

function WelcomeView({ theme, t, onStartChat, onSelectLine }: { theme: ThemeConfig; t: (k: string) => string; onStartChat: () => void; onSelectLine: (l: string) => void }) {
  const { colors, businessLines } = theme;

  const LINE_ICONS: Record<string, string> = { boostic: '📈', binnacle: '📊', marketing: '📣', tech: '💻' };

  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 28, background: `linear-gradient(135deg, ${colors.gradientFrom}, ${colors.gradientTo})`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        {Icons.chat('white')}
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: colors.text }}>{t('welcome_title')}</h3>
      <p style={{ fontSize: 13, color: colors.textSecondary, margin: '0 0 24px' }}>{t('welcome_subtitle')}</p>

      {theme.features.enableBusinessLines && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {businessLines.map(line => (
            <button
              key={line.id}
              onClick={() => onSelectLine(line.id)}
              style={{
                padding: '12px 8px', borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.background,
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                transition: 'all 0.2s', fontSize: 12, color: colors.text,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = line.color; e.currentTarget.style.background = line.color + '08'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.background = colors.background; }}
            >
              <span style={{ fontSize: 20 }}>{LINE_ICONS[line.id] || '🔹'}</span>
              <span style={{ fontWeight: 600 }}>{t(line.id)}</span>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={onStartChat}
        style={{
          width: '100%', padding: '12px 24px', borderRadius: 12, border: 'none',
          background: `linear-gradient(135deg, ${colors.gradientFrom}, ${colors.gradientTo})`,
          color: colors.textOnPrimary, fontWeight: 600, fontSize: 14, cursor: 'pointer',
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        {t('greeting').split('!')[0] || t('new_conversation')} →
      </button>
    </div>
  );
}

function ChatView({ theme, t, messages, isTyping, onSend, onEscalate, onCall, onCsat, isBusinessHours }: {
  theme: ThemeConfig; t: (k: string) => string; messages: ChatMessage[]; isTyping: boolean;
  onSend: (m: string) => void; onEscalate: () => void; onCall: () => void; onCsat: () => void; isBusinessHours: boolean;
}) {
  const { colors, features } = theme;
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 300 }}>
      {/* Messages */}
      <div className="rc-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: colors.textSecondary, fontSize: 13 }}>
            {t('greeting')}
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} colors={colors} />
        ))}
        {isTyping && features.enableTypingIndicator && (
          <div style={{ display: 'flex', gap: 3, padding: '8px 16px', background: colors.surface, borderRadius: 16, width: 'fit-content' }}>
            <span className="rc-typing-dot" style={{ width: 6, height: 6, borderRadius: 3, background: colors.textSecondary }} />
            <span className="rc-typing-dot" style={{ width: 6, height: 6, borderRadius: 3, background: colors.textSecondary }} />
            <span className="rc-typing-dot" style={{ width: 6, height: 6, borderRadius: 3, background: colors.textSecondary }} />
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, padding: '6px 16px', borderTop: `1px solid ${colors.border}`, flexWrap: 'wrap' }}>
        <ActionChip label={t('escalate')} icon={Icons.agent(colors.primary)} onClick={onEscalate} colors={colors} />
        {isBusinessHours && features.enableVoip && (
          <ActionChip label={t('call')} icon={Icons.phone(colors.primary)} onClick={onCall} colors={colors} />
        )}
        {features.enableCsat && messages.length > 2 && (
          <ActionChip label={t('rate_experience')} icon={Icons.star(colors.accent)} onClick={onCsat} colors={colors} />
        )}
      </div>

      {/* Input */}
      <form onSubmit={submit} style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: `1px solid ${colors.border}`, alignItems: 'center' }}>
        {features.enableAttachments && (
          <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: colors.textSecondary, display: 'flex' }}>
            {Icons.attach(colors.textSecondary)}
          </button>
        )}
        <input
          type="text" value={input} onChange={e => setInput(e.target.value)}
          placeholder={t('placeholder')}
          style={{
            flex: 1, padding: '10px 16px', border: `1.5px solid ${colors.border}`, borderRadius: 24,
            fontSize: 14, outline: 'none', background: colors.surface, color: colors.text,
            transition: 'border-color 0.2s',
          }}
          onFocus={e => (e.target.style.borderColor = colors.primary)}
          onBlur={e => (e.target.style.borderColor = colors.border)}
        />
        <button type="submit" disabled={!input.trim()} style={{
          width: 40, height: 40, borderRadius: 20, border: 'none',
          background: input.trim() ? `linear-gradient(135deg, ${colors.gradientFrom}, ${colors.gradientTo})` : colors.surface,
          color: input.trim() ? colors.textOnPrimary : colors.textSecondary,
          cursor: input.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}>
          {Icons.send(input.trim() ? colors.textOnPrimary : colors.textSecondary)}
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ message: msg, colors }: { message: ChatMessage; colors: ThemeConfig['colors'] }) {
  const isVisitor = msg.sender === 'visitor';
  const isSystem = msg.sender === 'system';

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', padding: '4px 0' }}>
        <span style={{ fontSize: 11, color: colors.textSecondary, background: colors.surface, padding: '4px 12px', borderRadius: 12, fontStyle: 'italic' }}>
          {msg.content}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: isVisitor ? 'flex-end' : 'flex-start' }} className="rc-animate-slide-up">
      {!isVisitor && (
        <div style={{ width: 28, height: 28, borderRadius: 14, background: msg.sender === 'agent' ? colors.success : `linear-gradient(135deg, ${colors.gradientFrom}, ${colors.gradientTo})`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, marginRight: 8 }}>
          {msg.sender === 'agent'
            ? <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>{(msg.agentName || 'A')[0]}</span>
            : <span style={{ color: 'white', fontSize: 14 }}>🤖</span>}
        </div>
      )}
      <div style={{ maxWidth: '78%' }}>
        {msg.agentName && !isVisitor && (
          <div style={{ fontSize: 11, color: colors.primary, fontWeight: 600, marginBottom: 2, paddingLeft: 4 }}>{msg.agentName}</div>
        )}
        <div
          className={isVisitor ? 'rc-bubble-visitor' : 'rc-bubble-other'}
          style={{
            padding: '10px 14px', borderRadius: 16, fontSize: 14, lineHeight: 1.5,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            ...(isVisitor
              ? { background: `linear-gradient(135deg, ${colors.gradientFrom}, ${colors.gradientTo})`, color: colors.textOnPrimary }
              : { background: colors.surface, color: colors.text, border: `1px solid ${colors.border}` }),
          }}
        >
          {msg.content}
        </div>
        <div style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2, padding: '0 4px', textAlign: isVisitor ? 'right' : 'left' }}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

function ActionChip({ label, icon, onClick, colors }: { label: string; icon: React.ReactNode; onClick: () => void; colors: ThemeConfig['colors'] }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
      fontSize: 11, borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.background,
      cursor: 'pointer', color: colors.text, transition: 'all 0.2s', fontWeight: 500,
    }}
      onMouseEnter={e => { e.currentTarget.style.background = colors.primaryLight; e.currentTarget.style.borderColor = colors.primary; }}
      onMouseLeave={e => { e.currentTarget.style.background = colors.background; e.currentTarget.style.borderColor = colors.border; }}
    >
      {icon} {label}
    </button>
  );
}

function OfflineFormView({ theme, t, onSubmit }: { theme: ThemeConfig; t: (k: string) => string; onSubmit: (d: any) => void }) {
  const { colors } = theme;
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    onSubmit(form);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
        <p style={{ fontSize: 14, color: colors.text, fontWeight: 600 }}>{t('offline_form_thanks')}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h4 style={{ fontSize: 15, fontWeight: 700, color: colors.text, marginBottom: 4 }}>{t('offline_title')}</h4>
      <p style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 16 }}>{t('offline_message')}</p>
      <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { key: 'name', type: 'text', label: t('offline_form_name'), required: true },
          { key: 'email', type: 'email', label: t('offline_form_email'), required: true },
          { key: 'phone', type: 'tel', label: t('offline_form_phone'), required: false },
          { key: 'message', type: 'text', label: t('offline_form_message'), required: false },
        ].map(f => (
          <input
            key={f.key} type={f.type} required={f.required} placeholder={f.label}
            value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
            style={{
              padding: '10px 14px', border: `1.5px solid ${colors.border}`, borderRadius: 10,
              fontSize: 13, outline: 'none', background: colors.surface, color: colors.text,
            }}
          />
        ))}
        <button type="submit" style={{
          padding: '12px', borderRadius: 10, border: 'none',
          background: `linear-gradient(135deg, ${colors.gradientFrom}, ${colors.gradientTo})`,
          color: colors.textOnPrimary, fontWeight: 600, fontSize: 14, cursor: 'pointer',
        }}>
          {t('offline_form_submit')}
        </button>
      </form>
    </div>
  );
}

function CsatView({ theme, t, onSubmit }: { theme: ThemeConfig; t: (k: string) => string; onSubmit: (rating: number, comment?: string) => void }) {
  const { colors } = theme;
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const labels = [t('rating_terrible'), t('rating_bad'), t('rating_okay'), t('rating_good'), t('rating_excellent')];

  if (submitted) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
        <p style={{ fontSize: 14, color: colors.text, fontWeight: 600 }}>{t('csat_thanks')}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <h4 style={{ fontSize: 15, fontWeight: 700, color: colors.text, marginBottom: 16 }}>{t('csat_question')}</h4>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, transition: 'transform 0.2s', transform: (hover >= n || rating >= n) ? 'scale(1.2)' : 'scale(1)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill={(hover >= n || rating >= n) ? colors.accent : colors.border}>
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
          </button>
        ))}
      </div>
      {(hover || rating) > 0 && (
        <p style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16 }}>{labels[(hover || rating) - 1]}</p>
      )}
      {rating > 0 && (
        <button onClick={() => { onSubmit(rating); setSubmitted(true); }} style={{
          padding: '10px 24px', borderRadius: 10, border: 'none',
          background: `linear-gradient(135deg, ${colors.gradientFrom}, ${colors.gradientTo})`,
          color: colors.textOnPrimary, fontWeight: 600, fontSize: 14, cursor: 'pointer',
        }}>
          {t('send')}
        </button>
      )}
    </div>
  );
}

function CallView({ theme, t, sip, onBack }: { theme: ThemeConfig; t: (k: string) => string; sip: ReturnType<typeof useSIP>; onBack: () => void }) {
  const { colors } = theme;
  return (
    <div style={{ padding: 32, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{
        width: 80, height: 80, borderRadius: 40,
        background: `linear-gradient(135deg, ${colors.gradientFrom}20, ${colors.gradientTo}20)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...(sip.callState === 'active' ? { animation: 'rc-pulse-ring 2s infinite' } : {}),
      }}>
        {Icons.phone(colors.primary)}
      </div>
      <p style={{ fontSize: 14, color: colors.textSecondary }}>{t(sip.callState === 'active' ? 'call' : 'call_connecting')}</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={sip.toggleMute} style={{ width: 48, height: 48, borderRadius: 24, border: `1px solid ${colors.border}`, background: sip.isMuted ? colors.error + '20' : colors.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {sip.isMuted ? Icons.mute(colors.error) : Icons.sound(colors.textSecondary)}
        </button>
        <button onClick={() => { sip.hangup(); onBack(); }} style={{ width: 48, height: 48, borderRadius: 24, border: 'none', background: colors.error, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
          {Icons.phone('white')}
        </button>
      </div>
      <button onClick={onBack} style={{ fontSize: 12, color: colors.textSecondary, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
        {t('back_to_chat')}
      </button>
    </div>
  );
}
