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

// ─── SVG Icons (crisp, minimal) ───
const I = {
  chat: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
    </svg>
  ),
  close: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  send: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  phone: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
    </svg>
  ),
  agent: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  attach: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
    </svg>
  ),
  sound: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
    </svg>
  ),
  mute: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
    </svg>
  ),
  star: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
    </svg>
  ),
  starOutline: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
    </svg>
  ),
  minimize: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  globe: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
    </svg>
  ),
  moon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
    </svg>
  ),
  sun: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  home: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  messageCircle: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
    </svg>
  ),
  arrowRight: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
};

// ─── Line config ───
const LINE_META: Record<string, { icon: string; gradient: string }> = {
  boostic: { icon: '📈', gradient: 'linear-gradient(135deg, #3B82F6, #1D4ED8)' },
  binnacle: { icon: '📊', gradient: 'linear-gradient(135deg, #8B5CF6, #6D28D9)' },
  marketing: { icon: '📣', gradient: 'linear-gradient(135deg, #10B981, #059669)' },
  tech: { icon: '💻', gradient: 'linear-gradient(135deg, #F59E0B, #D97706)' },
};

// ──────────────────────────────────────────────────────────
// MAIN WIDGET
// ──────────────────────────────────────────────────────────
export function Widget(props: WidgetConfig) {
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [view, setView] = useState<WidgetView>('welcome');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
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

  // Sound + unread on new messages
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

  // Auto-navigate to chat when messages arrive
  useEffect(() => {
    if (chat.messages.length > 0 && view === 'welcome') setView('chat');
  }, [chat.messages.length]);

  // Auto show offline form
  useEffect(() => {
    if (!chat.isBusinessHours && isOpen && view === 'welcome') setView('offline_form');
  }, [chat.isBusinessHours, isOpen, view]);

  const handleToggle = () => {
    if (isOpen) {
      setIsClosing(true);
      setTimeout(() => { setIsOpen(false); setIsClosing(false); }, 280);
    } else {
      setIsOpen(true);
      setUnread(0);
    }
  };

  // Expose API for external control
  useEffect(() => {
    (window as any).__redegalWidget = {
      open: () => { setIsOpen(true); setUnread(0); },
      close: () => handleToggle(),
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
    <div
      ref={rootRef}
      data-theme={darkMode ? 'dark' : 'light'}
      style={{ fontFamily: theme.typography.fontFamily, fontSize: theme.typography.fontSize, color: 'var(--rc-text)', lineHeight: 1.5 }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* ─── Floating Launcher Button ─── */}
      <button
        onClick={handleToggle}
        aria-label={isOpen ? 'Close chat' : 'Open chat support'}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={!isOpen ? 'rc-launcher-pulse' : ''}
        style={{
          position: 'fixed',
          [isLeft ? 'left' : 'right']: layout.offsetX,
          bottom: layout.offsetY,
          width: layout.buttonSize,
          height: layout.buttonSize,
          borderRadius: '50%',
          background: headerBg,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          zIndex: layout.zIndex,
          transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
          transform: isOpen ? 'scale(0.92)' : 'scale(1)',
          color: colors.textOnPrimary,
        }}
        onMouseEnter={e => { if (!isOpen) e.currentTarget.style.transform = 'scale(1.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = isOpen ? 'scale(0.92)' : 'scale(1)'; }}
      >
        <span className="rc-icon-morph" key={isOpen ? 'close' : 'chat'} style={{ display: 'flex' }}>
          {isOpen ? I.close : I.chat}
        </span>
        {unread > 0 && !isOpen && (
          <span className="rc-badge">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {/* ─── Panel ─── */}
      {isOpen && (
        <div
          className={`rc-widget-panel ${isClosing ? 'rc-panel-exit' : 'rc-panel-enter'}`}
          role="dialog"
          aria-label="Chat with Redegal"
          style={{
            position: 'fixed',
            [isLeft ? 'left' : 'right']: layout.offsetX,
            bottom: layout.offsetY + layout.buttonSize + 16,
            width: layout.width,
            maxHeight: layout.maxHeight,
            background: 'var(--rc-bg)',
            borderRadius: layout.borderRadius,
            boxShadow: 'var(--rc-shadow-xl)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid var(--rc-border)',
            zIndex: layout.zIndex,
          }}
        >
          {/* ─── Header ─── */}
          <div style={{
            background: headerBg,
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: layout.headerHeight,
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div className="rc-header-pattern" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt="" style={{ height: 30, width: 'auto', borderRadius: 6 }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: colors.textOnPrimary }}>R</span>
                </div>
              )}
              <div>
                <div style={{ color: colors.textOnPrimary, fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>{branding.companyName}</div>
                <div style={{ color: colors.textOnPrimary, opacity: 0.8, fontSize: 11, marginTop: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: chat.isConnected ? (chat.isBusinessHours ? '#34D399' : '#94A3B8') : '#F59E0B',
                    display: 'inline-block',
                    boxShadow: chat.isConnected && chat.isBusinessHours ? '0 0 6px #34D399' : 'none',
                  }} />
                  {chat.isConnected
                    ? (chat.isBusinessHours ? 'Online' : t('offline_title'))
                    : t('reconnecting')}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', position: 'relative', zIndex: 1 }}>
              {features.enableDarkMode && (
                <HeaderBtn onClick={() => setDarkMode(!darkMode)} color={colors.textOnPrimary}>
                  {darkMode ? I.sun : I.moon}
                </HeaderBtn>
              )}
              {features.enableSoundNotifications && (
                <HeaderBtn onClick={() => setSoundEnabled(!soundEnabled)} color={colors.textOnPrimary}>
                  {soundEnabled ? I.sound : I.mute}
                </HeaderBtn>
              )}
              {features.enableLanguageSelector && (
                <HeaderBtn onClick={() => setShowLangPicker(!showLangPicker)} color={colors.textOnPrimary}>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{LANG_META[chat.language]?.flag || '🌐'}</span>
                </HeaderBtn>
              )}
              <HeaderBtn onClick={handleToggle} color={colors.textOnPrimary}>
                {I.minimize}
              </HeaderBtn>
            </div>
          </div>

          {/* ─── Connection Status ─── */}
          {!chat.isConnected && (
            <div className="rc-connection-bar reconnecting">
              <span style={{ animation: 'rc-spin 1s linear infinite', display: 'inline-block', marginRight: 6 }}>⟳</span>
              {t('reconnecting')}
            </div>
          )}

          {/* ─── Language Picker (overlay) ─── */}
          {showLangPicker && (
            <div className="rc-fade-in" style={{
              background: 'var(--rc-surface)', borderBottom: '1px solid var(--rc-border)',
              padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 6,
              maxHeight: 140, overflowY: 'auto',
            }}>
              {theme.i18n.availableLanguages.map(l => {
                const meta = LANG_META[l];
                if (!meta) return null;
                const active = chat.language === l;
                return (
                  <button key={l} onClick={() => { chat.setLanguage(l); setShowLangPicker(false); }}
                    style={{
                      padding: '5px 12px', fontSize: 12, borderRadius: 'var(--rc-radius-pill)',
                      cursor: 'pointer', transition: 'all 0.2s',
                      border: active ? '1.5px solid var(--rc-primary)' : '1px solid var(--rc-border)',
                      background: active ? 'var(--rc-primary-light)' : 'var(--rc-bg)',
                      fontWeight: active ? 600 : 400, color: 'var(--rc-text)',
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
              <WelcomeView theme={theme} t={t} darkMode={darkMode}
                onStartChat={() => setView('chat')}
                onSelectLine={(l) => { chat.setBusinessLine(l); setView('chat'); }} />
            ) : view === 'offline_form' ? (
              <OfflineFormView theme={theme} t={t}
                onSubmit={(data) => { chat.submitOfflineForm({ ...data, language: chat.language }); }} />
            ) : view === 'csat' ? (
              <CsatView theme={theme} t={t}
                onSubmit={(r, c) => { chat.submitCsat(r, c); setView('chat'); }} />
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
            <div style={{
              textAlign: 'center', padding: '7px 0', fontSize: 10, fontWeight: 500,
              color: 'var(--rc-text-tertiary)',
              borderTop: '1px solid var(--rc-border)',
              background: 'var(--rc-surface)',
              letterSpacing: '0.02em',
            }}>
              {branding.poweredByText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Header icon button ───
function HeaderBtn({ onClick, children, color }: { onClick: () => void; children: React.ReactNode; color: string }) {
  return (
    <button onClick={onClick} style={{
      background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8,
      width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, transition: 'background 0.15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
    >
      {children}
    </button>
  );
}

// ──────────────────────────────────────────────────────────
// WELCOME VIEW (Intercom-style home screen)
// ──────────────────────────────────────────────────────────
function WelcomeView({ theme, t, darkMode, onStartChat, onSelectLine }: {
  theme: ThemeConfig; t: (k: string) => string; darkMode: boolean;
  onStartChat: () => void; onSelectLine: (l: string) => void;
}) {
  return (
    <div className="rc-slide-up" style={{ padding: '28px 20px 20px', overflowY: 'auto' }}>
      {/* Hero */}
      <div className="rc-welcome-icon" style={{
        background: `linear-gradient(135deg, ${theme.colors.gradientFrom}18, ${theme.colors.gradientTo}18)`,
      }}>
        <span style={{ fontSize: 28 }}>💬</span>
      </div>
      <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px', color: 'var(--rc-text)', textAlign: 'center', letterSpacing: '-0.02em' }}>
        {t('welcome_title')}
      </h3>
      <p style={{ fontSize: 13, color: 'var(--rc-text-secondary)', margin: '0 0 24px', textAlign: 'center', lineHeight: 1.5 }}>
        {t('welcome_subtitle')}
      </p>

      {/* Business Lines */}
      {theme.features.enableBusinessLines && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {theme.businessLines.map(line => {
            const meta = LINE_META[line.id];
            return (
              <button
                key={line.id}
                className="rc-line-chip"
                onClick={() => onSelectLine(line.id)}
                style={{ '--line-color': line.color } as React.CSSProperties}
              >
                <span style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: meta?.gradient || `${line.color}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                }}>
                  {meta?.icon || '🔹'}
                </span>
                <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--rc-text)' }}>
                  {t(line.id)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* CTA Button */}
      <button onClick={onStartChat} className="rc-btn-primary" style={{ width: '100%' }}>
        {t('greeting').split('!')[0] || t('new_conversation')}
        <span style={{ display: 'flex' }}>{I.arrowRight}</span>
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// CHAT VIEW
// ──────────────────────────────────────────────────────────
function ChatView({ theme, t, messages, isTyping, onSend, onEscalate, onCall, onCsat, isBusinessHours }: {
  theme: ThemeConfig; t: (k: string) => string; messages: ChatMessage[]; isTyping: boolean;
  onSend: (m: string) => void; onEscalate: () => void; onCall: () => void; onCsat: () => void; isBusinessHours: boolean;
}) {
  const { features } = theme;
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
    inputRef.current?.focus();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 280 }}>
      {/* Messages */}
      <div className="rc-scrollbar" role="log" aria-live="polite" style={{
        flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {messages.length === 0 && (
          <div className="rc-slide-up" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--rc-text-secondary)' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14, margin: '0 auto 12px',
              background: 'var(--rc-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 22 }}>👋</span>
            </div>
            <p style={{ fontSize: 14, fontWeight: 500 }}>{t('greeting')}</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const prev = i > 0 ? messages[i - 1] : null;
          const isGrouped = prev && prev.sender === msg.sender && (new Date(msg.timestamp).getTime() - new Date(prev.timestamp).getTime() < 60000);
          return <MessageBubble key={i} message={msg} isGrouped={!!isGrouped} />;
        })}
        {isTyping && features.enableTypingIndicator && (
          <div className="rc-msg-enter" style={{ display: 'flex', alignItems: 'flex-end', gap: 8, paddingTop: 4 }}>
            <div className="rc-avatar" style={{ background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`, width: 28, height: 28, fontSize: 11 }}>
              <span>🤖</span>
            </div>
            <div style={{
              display: 'flex', gap: 5, padding: '12px 18px',
              background: 'var(--rc-bubble-bot)', borderRadius: 'var(--rc-radius-bubble)',
              borderBottomLeftRadius: 6,
            }}>
              <span className="rc-typing-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--rc-text-tertiary)' }} />
              <span className="rc-typing-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--rc-text-tertiary)' }} />
              <span className="rc-typing-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--rc-text-tertiary)' }} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Action chips */}
      <div style={{ display: 'flex', gap: 6, padding: '6px 14px', borderTop: '1px solid var(--rc-border-subtle)', flexWrap: 'wrap' }}>
        <button className="rc-btn-ghost" onClick={onEscalate}>
          {I.agent} {t('escalate')}
        </button>
        {isBusinessHours && features.enableVoip && (
          <button className="rc-btn-ghost" onClick={onCall}>
            {I.phone} {t('call')}
          </button>
        )}
        {features.enableCsat && messages.length > 2 && (
          <button className="rc-btn-ghost" onClick={onCsat} style={{ marginLeft: 'auto' }}>
            ⭐ {t('rate_experience')}
          </button>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={submit} style={{
        display: 'flex', gap: 8, padding: '10px 14px',
        borderTop: '1px solid var(--rc-border)', alignItems: 'center',
        background: 'var(--rc-bg)',
      }}>
        {features.enableAttachments && (
          <button type="button" style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            color: 'var(--rc-text-tertiary)', display: 'flex', transition: 'color 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--rc-text-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--rc-text-tertiary)')}
          >
            {I.attach}
          </button>
        )}
        <input
          ref={inputRef}
          type="text" value={input} onChange={e => setInput(e.target.value)}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          className="rc-input-focus"
          style={{
            flex: 1, padding: '11px 18px', border: '1.5px solid var(--rc-border)',
            borderRadius: 'var(--rc-radius-pill)', fontSize: 14, outline: 'none',
            background: 'var(--rc-surface)', color: 'var(--rc-text)',
            transition: 'all 0.2s',
          }}
        />
        <button type="submit" disabled={!input.trim()} aria-label={t('send')} style={{
          width: 42, height: 42, borderRadius: 21, border: 'none',
          background: input.trim()
            ? `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`
            : 'var(--rc-surface)',
          color: input.trim() ? theme.colors.textOnPrimary : 'var(--rc-text-tertiary)',
          cursor: input.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.25s var(--rc-ease-standard)',
          boxShadow: input.trim() ? '0 2px 10px rgba(227,6,19,0.25)' : 'none',
          transform: input.trim() ? 'scale(1)' : 'scale(0.92)',
        }}>
          {I.send}
        </button>
      </form>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// MESSAGE BUBBLE
// ──────────────────────────────────────────────────────────
function MessageBubble({ message: msg, isGrouped }: { message: ChatMessage; isGrouped: boolean }) {
  const isVisitor = msg.sender === 'visitor';
  const isSystem = msg.sender === 'system';

  if (isSystem) {
    return (
      <div className="rc-msg-enter" style={{ textAlign: 'center', padding: '6px 0' }}>
        <span style={{
          fontSize: 11, color: 'var(--rc-text-tertiary)', background: 'var(--rc-surface)',
          padding: '5px 14px', borderRadius: 'var(--rc-radius-pill)', fontWeight: 500,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ opacity: 0.7 }}>ℹ</span> {msg.content}
        </span>
      </div>
    );
  }

  return (
    <div className="rc-msg-enter" style={{
      display: 'flex', justifyContent: isVisitor ? 'flex-end' : 'flex-start',
      marginTop: isGrouped ? 2 : 10,
      alignItems: 'flex-end',
      gap: 8,
    }}>
      {/* Avatar (bot/agent) — only show on first of group */}
      {!isVisitor && !isGrouped && (
        <div className="rc-avatar" style={{
          background: msg.sender === 'agent'
            ? 'linear-gradient(135deg, #10B981, #059669)'
            : 'linear-gradient(135deg, var(--rc-primary), var(--rc-primary-hover, #B8050F))',
          width: 30, height: 30, fontSize: 12,
        }}>
          {msg.sender === 'agent'
            ? (msg.agentName || 'A')[0].toUpperCase()
            : <span style={{ fontSize: 14 }}>✦</span>}
        </div>
      )}
      {!isVisitor && isGrouped && <div style={{ width: 30, flexShrink: 0 }} />}

      <div style={{ maxWidth: '78%' }}>
        {/* Agent name */}
        {msg.agentName && !isVisitor && !isGrouped && (
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rc-primary)', marginBottom: 3, paddingLeft: 2 }}>
            {msg.agentName}
          </div>
        )}
        {/* Bubble */}
        <div
          className={isVisitor
            ? `rc-bubble-user ${isGrouped ? 'rc-grouped' : ''}`
            : `rc-bubble-bot ${isGrouped ? 'rc-grouped' : ''}`}
          style={{
            padding: '10px 16px', fontSize: 14, lineHeight: 1.55,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            ...(isVisitor
              ? {
                  background: `linear-gradient(135deg, var(--rc-primary), var(--rc-primary-hover, #B8050F))`,
                  color: 'var(--rc-on-primary)',
                  boxShadow: '0 1px 4px rgba(227,6,19,0.15)',
                }
              : {
                  background: 'var(--rc-bubble-bot)',
                  color: 'var(--rc-bubble-bot-text)',
                  border: '1px solid var(--rc-border-subtle)',
                }),
          }}
        >
          {msg.content}
        </div>
        {/* Timestamp */}
        {!isGrouped && (
          <div style={{
            fontSize: 10, color: 'var(--rc-text-tertiary)', marginTop: 3,
            padding: '0 4px', textAlign: isVisitor ? 'right' : 'left',
          }}>
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// OFFLINE FORM
// ──────────────────────────────────────────────────────────
function OfflineFormView({ theme, t, onSubmit }: { theme: ThemeConfig; t: (k: string) => string; onSubmit: (d: any) => void }) {
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
      <div className="rc-slide-up" style={{ padding: 40, textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
          background: 'linear-gradient(135deg, #10B981, #059669)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--rc-text)', marginBottom: 4 }}>{t('offline_form_thanks')}</p>
        <p style={{ fontSize: 12, color: 'var(--rc-text-secondary)' }}>Te responderemos lo antes posible</p>
      </div>
    );
  }

  return (
    <div className="rc-slide-up" style={{ padding: '22px 20px' }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, marginBottom: 14,
        background: 'var(--rc-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 22 }}>✉️</span>
      </div>
      <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--rc-text)', marginBottom: 4, letterSpacing: '-0.01em' }}>{t('offline_title')}</h4>
      <p style={{ fontSize: 13, color: 'var(--rc-text-secondary)', marginBottom: 18, lineHeight: 1.4 }}>{t('offline_message')}</p>
      <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { key: 'name', type: 'text', label: t('offline_form_name'), required: true },
          { key: 'email', type: 'email', label: t('offline_form_email'), required: true },
          { key: 'phone', type: 'tel', label: t('offline_form_phone'), required: false },
        ].map(f => (
          <input key={f.key} type={f.type} required={f.required} placeholder={f.label}
            className="rc-input rc-input-focus"
            value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
          />
        ))}
        <textarea
          placeholder={t('offline_form_message')} rows={3}
          className="rc-input rc-input-focus"
          style={{ resize: 'none', fontFamily: 'inherit' }}
          value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
        />
        <button type="submit" className="rc-btn-primary" style={{ width: '100%', marginTop: 4 }}>
          {t('offline_form_submit')}
        </button>
      </form>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// CSAT VIEW
// ──────────────────────────────────────────────────────────
function CsatView({ theme, t, onSubmit }: { theme: ThemeConfig; t: (k: string) => string; onSubmit: (rating: number, comment?: string) => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const labels = [t('rating_terrible'), t('rating_bad'), t('rating_okay'), t('rating_good'), t('rating_excellent')];
  const emojis = ['😠', '😕', '😐', '🙂', '🤩'];

  if (submitted) {
    return (
      <div className="rc-slide-up" style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--rc-text)' }}>{t('csat_thanks')}</p>
      </div>
    );
  }

  return (
    <div className="rc-slide-up" style={{ padding: '32px 24px', textAlign: 'center' }}>
      <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--rc-text)', marginBottom: 24, letterSpacing: '-0.01em' }}>{t('csat_question')}</h4>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
            className={rating === n ? 'rc-star-pop' : ''}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 6,
              transition: 'transform 0.2s var(--rc-ease-spring)',
              transform: (hover >= n || rating >= n) ? 'scale(1.15)' : 'scale(1)',
              opacity: (hover >= n || rating >= n) ? 1 : 0.4,
              fontSize: 28,
            }}>
            {emojis[n - 1]}
          </button>
        ))}
      </div>
      {(hover || rating) > 0 && (
        <p className="rc-fade-in" style={{ fontSize: 13, color: 'var(--rc-text-secondary)', marginBottom: 20, fontWeight: 500 }}>
          {labels[(hover || rating) - 1]}
        </p>
      )}
      {rating > 0 && (
        <button onClick={() => { onSubmit(rating); setSubmitted(true); }}
          className="rc-btn-primary rc-fade-in" style={{ padding: '10px 32px' }}>
          {t('send')}
        </button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// CALL VIEW
// ──────────────────────────────────────────────────────────
function CallView({ theme, t, sip, onBack }: { theme: ThemeConfig; t: (k: string) => string; sip: ReturnType<typeof useSIP>; onBack: () => void }) {
  const isActive = sip.callState === 'active';

  return (
    <div className="rc-slide-up" style={{ padding: '40px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <div style={{
        width: 88, height: 88, borderRadius: 44, position: 'relative',
        background: `linear-gradient(135deg, ${theme.colors.gradientFrom}15, ${theme.colors.gradientTo}15)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--rc-primary)',
      }}>
        {isActive && (
          <div style={{
            position: 'absolute', inset: -10, borderRadius: '50%',
            border: '2px solid var(--rc-primary)',
            animation: 'rc-pulse-ring 2s ease-out infinite', opacity: 0.4,
          }} />
        )}
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
        </svg>
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--rc-text)' }}>
        {t(isActive ? 'call' : 'call_connecting')}
      </p>
      {isActive && (
        <p style={{ fontSize: 12, color: 'var(--rc-text-tertiary)' }}>En llamada...</p>
      )}
      <div style={{ display: 'flex', gap: 16 }}>
        <button onClick={sip.toggleMute} style={{
          width: 52, height: 52, borderRadius: 26,
          border: '1.5px solid var(--rc-border)',
          background: sip.isMuted ? 'rgba(239,68,68,0.1)' : 'var(--rc-surface)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: sip.isMuted ? 'var(--rc-error)' : 'var(--rc-text-secondary)',
          transition: 'all 0.2s',
        }}>
          {sip.isMuted ? I.mute : I.sound}
        </button>
        <button onClick={() => { sip.hangup(); onBack(); }} style={{
          width: 52, height: 52, borderRadius: 26, border: 'none',
          background: 'linear-gradient(135deg, #EF4444, #DC2626)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
          transition: 'all 0.2s',
        }}>
          {I.phone}
        </button>
      </div>
      <button onClick={onBack} style={{
        fontSize: 12, color: 'var(--rc-text-tertiary)', background: 'none',
        border: 'none', cursor: 'pointer', fontWeight: 500, transition: 'color 0.15s',
      }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--rc-text-secondary)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--rc-text-tertiary)')}
      >
        ← {t('back_to_chat')}
      </button>
    </div>
  );
}
