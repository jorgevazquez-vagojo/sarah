import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useChat, ChatMessage, RichContent } from './hooks/useChat';
import { useLanguage } from './hooks/useLanguage';
import { useSIP } from './hooks/useSIP';
import { useCallQuality } from './hooks/useCallQuality';
import { ThemeConfig, RichContent as RichContentType } from './lib/types';
import { applyTheme, DEFAULT_THEME } from './lib/theme';
import { playSound } from './lib/sounds';
import { CallQualityMetrics } from './lib/audio-quality';

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
  search: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  book: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
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
  type ViewType = 'welcome' | 'chat' | 'call' | 'offline_form' | 'csat' | 'help' | 'lead_form';
  const [view, setView] = useState<ViewType>('welcome');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);

  const [visitorId] = useState(() => getVisitorId());
  const wsUrl = props.apiUrl || `${(props.baseUrl || '').replace(/^http/, 'ws').replace(/\/widget$/, '')}/ws/chat`;
  const chat = useChat({ apiUrl: wsUrl, visitorId });
  const { t, isRTL } = useLanguage(chat.language, props.baseUrl?.replace('/widget', ''));
  const sip = useSIP();
  const callQuality = useCallQuality(sip.qualityMonitor);
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

  // Server requests lead form (from rich message action)
  useEffect(() => {
    if (chat.showLeadForm) { setView('lead_form'); chat.clearLeadForm(); }
  }, [chat.showLeadForm]);

  // RDGPhone: show phone form when server requests it
  useEffect(() => {
    if (chat.showPhoneForm) {
      setView('call');
      chat.clearPhoneForm();
    }
  }, [chat.showPhoneForm]);

  // WebRTC via Janus: when server sends webrtc_ready, start the call
  useEffect(() => {
    if (chat.webrtcConfig) {
      const cfg = chat.webrtcConfig;
      setView('call');
      sip.startCall({
        janusWsUrl: cfg.janusWsUrl,
        sipProxy: cfg.sipProxy,
        sipUser: cfg.sipUser,
        sipPassword: cfg.sipPassword,
        targetUri: cfg.targetUri,
        callId: cfg.callId,
        iceServers: cfg.iceServers,
      });
      chat.clearWebrtcConfig();
    }
  }, [chat.webrtcConfig]);

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

  // ─── Accessibility: ESC to close widget ───
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleToggle();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // ─── Accessibility: Focus trap when widget is open ───
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const panel = panelRef.current;
    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = Array.from(panel.querySelectorAll(focusableSelector)) as HTMLElement[];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || !panel.contains(document.activeElement as Node)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !panel.contains(document.activeElement as Node)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTab);
    // Focus first focusable element when widget opens
    const firstFocusable = panel.querySelector(focusableSelector) as HTMLElement;
    if (firstFocusable) setTimeout(() => firstFocusable.focus(), 100);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

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
          ref={panelRef}
          className={`rc-widget-panel ${isClosing ? 'rc-panel-exit' : 'rc-panel-enter'}`}
          role="dialog"
          aria-modal="true"
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
                  <span style={{
                    padding: '1px 8px', borderRadius: 20, fontSize: 8, fontWeight: 700,
                    background: 'rgba(255,255,255,0.15)', color: colors.textOnPrimary,
                    letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                    border: '1px solid rgba(255,255,255,0.3)',
                    backdropFilter: 'blur(4px)',
                  }}>Beta</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', position: 'relative', zIndex: 1 }}>
              {features.enableDarkMode && (
                <HeaderBtn onClick={() => setDarkMode(!darkMode)} color={colors.textOnPrimary} ariaLabel={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
                  {darkMode ? I.sun : I.moon}
                </HeaderBtn>
              )}
              {features.enableSoundNotifications && (
                <HeaderBtn onClick={() => setSoundEnabled(!soundEnabled)} color={colors.textOnPrimary} ariaLabel={soundEnabled ? 'Mute notifications' : 'Enable notifications'}>
                  {soundEnabled ? I.sound : I.mute}
                </HeaderBtn>
              )}
              {features.enableLanguageSelector && (
                <HeaderBtn onClick={() => setShowLangPicker(!showLangPicker)} color={colors.textOnPrimary} ariaLabel="Change language">
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{LANG_META[chat.language]?.flag || '🌐'}</span>
                </HeaderBtn>
              )}
              <HeaderBtn onClick={handleToggle} color={colors.textOnPrimary} ariaLabel="Minimize chat">
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
            <div className="rc-fade-in" role="radiogroup" aria-label="Select language" style={{
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
                    aria-label={`Switch to ${meta.label}`}
                    aria-pressed={active}
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
                onSelectLine={(l) => { chat.setBusinessLine(l); setView('chat'); }}
                />
            ) : view === 'offline_form' ? (
              <OfflineFormView theme={theme} t={t}
                onSubmit={(data) => { chat.submitOfflineForm({ ...data, language: chat.language }); }} />
            ) : view === 'csat' ? (
              <CsatView theme={theme} t={t}
                onSubmit={(r, c) => { chat.submitCsat(r, c); setView('chat'); }} />
            ) : view === 'call' ? (
              <CallView theme={theme} t={t} callStatus={chat.callStatus}
                onRequestCall={(phone) => chat.requestCall(phone)}
                onRequestWebRTCCall={() => chat.requestWebRTCCall()}
                onBack={() => { chat.resetCallStatus(); sip.hangup(); setView('chat'); }}
                sipState={sip.callState}
                isMuted={sip.isMuted}
                onToggleMute={sip.toggleMute}
                onHangup={() => {
                  // Notify server of hangup for recording
                  if (chat.callStatus.callId) {
                    chat.sendWebRTCHangup(chat.callStatus.callId);
                  }
                  sip.hangup();
                }}
                qualityMetrics={callQuality.metrics}
                qualitySignal={callQuality.signal}
                qualityWarnings={callQuality.warnings} />
            ) : view === 'lead_form' ? (
              <LeadFormView theme={theme} t={t}
                onSubmit={(data) => { chat.submitLead(data); chat.clearLeadForm(); setView('chat'); }}
                onBack={() => setView('chat')} />
            ) : (
              <ChatView
                theme={theme} t={t} messages={chat.messages} isTyping={chat.isTyping}
                onSend={chat.sendMessage} onEscalate={chat.escalate}
                onCall={() => { chat.isBusinessHours ? setView('call') : setView('offline_form'); }}
                onCsat={() => setView('csat')}
                isBusinessHours={chat.isBusinessHours}
                onQuickReply={chat.sendQuickReply}
                onUpload={(f) => chat.uploadFile(f, props.baseUrl?.replace('/widget', '') || '')}
                onLeadForm={() => setView('lead_form')}
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
function HeaderBtn({ onClick, children, color, ariaLabel }: { onClick: () => void; children: React.ReactNode; color: string; ariaLabel?: string }) {
  return (
    <button onClick={onClick} aria-label={ariaLabel} style={{
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
  theme: ThemeConfig; t: (k: string, vars?: Record<string, string>) => string; darkMode: boolean;
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

      {/* CTA Buttons */}
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
function ChatView({ theme, t, messages, isTyping, onSend, onEscalate, onCall, onCsat, isBusinessHours, onQuickReply, onUpload, onLeadForm }: {
  theme: ThemeConfig; t: (k: string, vars?: Record<string, string>) => string; messages: ChatMessage[]; isTyping: boolean;
  onSend: (m: string) => void; onEscalate: () => void; onCall: () => void; onCsat: () => void; isBusinessHours: boolean;
  onQuickReply?: (v: string) => void; onUpload?: (f: File) => Promise<any>; onLeadForm?: () => void;
}) {
  const { features } = theme;
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;
    if (file.size > (features.maxFileSize || 10485760)) {
      alert(t('file_too_large'));
      return;
    }
    setUploading(true);
    try { await onUpload(file); } catch { /* handled */ }
    setUploading(false);
    e.target.value = '';
  };

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
          return (
            <React.Fragment key={i}>
              <MessageBubble message={msg} isGrouped={!!isGrouped} />
              {msg.richContent && (
                <RichContentBlock content={msg.richContent} theme={theme}
                  onQuickReply={(v) => {
                    if (v === '__escalate__') onEscalate();
                    else if (v === '__lead_form__' && onLeadForm) onLeadForm();
                    else if (v === '__call__') onCall();
                    else if (onQuickReply) onQuickReply(v);
                    else onSend(v);
                  }} />
              )}
            </React.Fragment>
          );
        })}
        {isTyping && features.enableTypingIndicator && (
          <div className="rc-msg-enter" role="status" aria-label="Assistant is typing" style={{ display: 'flex', alignItems: 'flex-end', gap: 8, paddingTop: 4 }}>
            <div className="rc-avatar" style={{ background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`, width: 28, height: 28, fontSize: 11 }}>
              <span aria-hidden="true">🤖</span>
            </div>
            <div style={{
              display: 'flex', gap: 5, padding: '12px 18px',
              background: 'var(--rc-bubble-bot)', borderRadius: 'var(--rc-radius-bubble)',
              borderBottomLeftRadius: 6,
            }}>
              <span className="rc-typing-dot" aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--rc-text-tertiary)' }} />
              <span className="rc-typing-dot" aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--rc-text-tertiary)' }} />
              <span className="rc-typing-dot" aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--rc-text-tertiary)' }} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Action chips */}
      <div role="toolbar" aria-label="Chat actions" style={{ display: 'flex', gap: 6, padding: '6px 14px', borderTop: '1px solid var(--rc-border-subtle)', flexWrap: 'wrap' }}>
        <button className="rc-btn-ghost" onClick={onEscalate} aria-label="Talk to a human agent">
          {I.agent} {t('escalate')}
        </button>
        {isBusinessHours && features.enableVoip && (
          <button className="rc-btn-ghost" onClick={onCall} aria-label="Start a phone call">
            {I.phone} {t('call')}
          </button>
        )}
        {features.enableCsat && messages.length > 2 && (
          <button className="rc-btn-ghost" onClick={onCsat} style={{ marginLeft: 'auto' }} aria-label="Rate your experience">
            <span aria-hidden="true">⭐</span> {t('rate_experience')}
          </button>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={submit} style={{
        display: 'flex', gap: 8, padding: '10px 14px',
        borderTop: '1px solid var(--rc-border)', alignItems: 'center',
        background: 'var(--rc-bg)',
      }}>
        {features.enableAttachments && onUpload && (
          <>
            <input ref={fileRef} type="file" hidden aria-label="Upload file"
              accept={features.allowedFileTypes?.join(',') || 'image/*,application/pdf,.doc,.docx,.xls,.xlsx'}
              onChange={handleFileChange} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              aria-label={uploading ? 'Uploading file...' : 'Attach a file'}
              style={{
                background: 'none', border: 'none', cursor: uploading ? 'wait' : 'pointer', padding: 4,
                color: uploading ? 'var(--rc-primary)' : 'var(--rc-text-tertiary)', display: 'flex', transition: 'color 0.15s',
              }}
              onMouseEnter={e => { if (!uploading) e.currentTarget.style.color = 'var(--rc-text-secondary)'; }}
              onMouseLeave={e => { if (!uploading) e.currentTarget.style.color = 'var(--rc-text-tertiary)'; }}
            >
              {uploading ? <span aria-hidden="true" style={{ animation: 'rc-spin 1s linear infinite', display: 'inline-block' }}>⟳</span> : I.attach}
            </button>
          </>
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
          boxShadow: input.trim() ? '0 2px 10px rgba(0,127,255,0.25)' : 'none',
          transform: input.trim() ? 'scale(1)' : 'scale(0.92)',
        }}>
          {I.send}
        </button>
      </form>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// RICH CONTENT BLOCK
// ──────────────────────────────────────────────────────────
function RichContentBlock({ content, theme, onQuickReply }: {
  content: RichContent; theme: ThemeConfig; onQuickReply: (v: string) => void;
}) {
  if (!content?.type) return null;

  if (content.type === 'quick_replies') {
    return (
      <div className="rc-msg-enter" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 46px' }}>
        {(content.replies || []).map((r, i) => (
          <button key={i} onClick={() => onQuickReply(r.value)} className="rc-quick-reply" style={{
            padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--rc-radius-pill)',
            border: '1.5px solid var(--rc-primary)', background: 'var(--rc-bg)',
            color: 'var(--rc-primary)', cursor: 'pointer', transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--rc-primary)'; e.currentTarget.style.color = 'var(--rc-on-primary, white)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--rc-bg)'; e.currentTarget.style.color = 'var(--rc-primary)'; }}
          >{r.label}</button>
        ))}
      </div>
    );
  }

  if (content.type === 'card') {
    return (
      <div className="rc-msg-enter" style={{ padding: '4px 46px' }}>
        <div style={{
          background: 'var(--rc-surface)', border: '1px solid var(--rc-border)',
          borderRadius: 14, overflow: 'hidden', maxWidth: 280,
        }}>
          {content.imageUrl && (
            <img src={content.imageUrl} alt={content.title || 'Card image'} style={{ width: '100%', height: 140, objectFit: 'cover' }} />
          )}
          <div style={{ padding: '12px 14px' }}>
            {content.title && <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--rc-text)', marginBottom: 4 }}>{content.title}</div>}
            {content.subtitle && <div style={{ fontSize: 12, color: 'var(--rc-text-secondary)', marginBottom: 10, lineHeight: 1.4 }}>{content.subtitle}</div>}
            {(content.buttons || []).map((btn, i) => (
              <button key={i} onClick={() => onQuickReply(btn.value)} style={{
                display: 'block', width: '100%', padding: '9px 12px', fontSize: 13, fontWeight: 600,
                background: i === 0 ? 'var(--rc-primary)' : 'transparent',
                color: i === 0 ? 'white' : 'var(--rc-primary)',
                border: i === 0 ? 'none' : '1px solid var(--rc-border)',
                borderRadius: 8, cursor: 'pointer', marginTop: 6, transition: 'all 0.15s',
                textAlign: 'center',
              }}>{btn.label}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (content.type === 'buttons') {
    return (
      <div className="rc-msg-enter" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 46px' }}>
        {(content.buttons || []).map((btn, i) => (
          <button key={i} onClick={() => onQuickReply(btn.value)} style={{
            padding: '9px 16px', fontSize: 13, fontWeight: 600, borderRadius: 10,
            border: '1.5px solid var(--rc-border)', background: 'var(--rc-bg)',
            color: 'var(--rc-text)', cursor: 'pointer', transition: 'all 0.15s',
            textAlign: 'left',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--rc-primary)'; e.currentTarget.style.color = 'var(--rc-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--rc-border)'; e.currentTarget.style.color = 'var(--rc-text)'; }}
          >{btn.label}</button>
        ))}
      </div>
    );
  }

  if (content.type === 'carousel') {
    return (
      <div className="rc-msg-enter" style={{ padding: '4px 0', overflowX: 'auto', display: 'flex', gap: 10, paddingLeft: 46, paddingRight: 16 }}>
        {(content.cards || []).map((c, i) => (
          <div key={i} style={{ flex: '0 0 220px' }}>
            <RichContentBlock content={c} theme={theme} onQuickReply={onQuickReply} />
          </div>
        ))}
      </div>
    );
  }

  return null;
}

// ──────────────────────────────────────────────────────────
// LEAD FORM VIEW (standalone form from rich message action)
// ──────────────────────────────────────────────────────────
function LeadFormView({ theme, t, onSubmit, onBack }: {
  theme: ThemeConfig; t: (k: string, vars?: Record<string, string>) => string;
  onSubmit: (data: { name: string; email: string; phone?: string; company?: string }) => void; onBack: () => void;
}) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '' });
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
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--rc-text)', marginBottom: 4 }}>
          {t('lead_thanks') || 'Gracias, nos pondremos en contacto pronto'}
        </p>
        <button onClick={onBack} style={{
          marginTop: 16, fontSize: 13, color: 'var(--rc-primary)', background: 'none',
          border: 'none', cursor: 'pointer', fontWeight: 600,
        }}>
          ← {t('back_to_chat')}
        </button>
      </div>
    );
  }

  return (
    <div className="rc-slide-up" style={{ padding: '22px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          color: 'var(--rc-text-secondary)', display: 'flex',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--rc-text)', margin: 0 }}>
          {t('lead_form_title')}
        </h4>
      </div>
      <p style={{ fontSize: 13, color: 'var(--rc-text-secondary)', marginBottom: 16, lineHeight: 1.4 }}>
        {t('lead_form_subtitle')}
      </p>
      <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input type="text" required placeholder={t('offline_form_name') || 'Nombre *'}
          className="rc-input rc-input-focus"
          value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input type="email" required placeholder={t('offline_form_email') || 'Email *'}
          className="rc-input rc-input-focus"
          value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <input type="tel" placeholder={t('offline_form_phone')}
          className="rc-input rc-input-focus"
          value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <input type="text" placeholder={t('lead_form_company') || 'Empresa'}
          className="rc-input rc-input-focus"
          value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
        <button type="submit" className="rc-btn-primary" style={{ width: '100%', marginTop: 4 }}>
          {t('lead_form_submit') || 'Enviar solicitud'}
        </button>
      </form>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// MESSAGE BUBBLE
// ──────────────────────────────────────────────────────────
// ─── Read receipt checkmarks ───
function StatusIcon({ status }: { status?: string }) {
  if (!status || status === 'sending') return <span style={{ opacity: 0.4 }}>○</span>;
  if (status === 'sent') return (
    <svg width="14" height="10" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
      <polyline points="1 6 5 10 14 1"/>
    </svg>
  );
  const isRead = status === 'read';
  return (
    <svg width="18" height="10" viewBox="0 0 20 12" fill="none" stroke={isRead ? '#34D399' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: isRead ? 1 : 0.5 }}>
      <polyline points="1 6 5 10 14 1"/><polyline points="6 6 10 10 19 1"/>
    </svg>
  );
}

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
            : 'linear-gradient(135deg, var(--rc-primary), var(--rc-primary-hover, #0066cc))',
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
        {/* Attachments (images/files) */}
        {msg.attachments && msg.attachments.length > 0 && msg.attachments.map((att, i) => (
          <div key={i} style={{ marginBottom: 4 }}>
            {att.mimeType.startsWith('image/') ? (
              <img src={att.url} alt={att.name} style={{
                maxWidth: '100%', maxHeight: 200, borderRadius: 10,
                border: '1px solid var(--rc-border-subtle)', cursor: 'pointer',
              }} onClick={() => window.open(att.url, '_blank')} />
            ) : (
              <a href={att.url} target="_blank" rel="noopener noreferrer" style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                background: 'var(--rc-surface)', border: '1px solid var(--rc-border)',
                borderRadius: 10, textDecoration: 'none', fontSize: 12, color: 'var(--rc-text)',
              }}>
                <span style={{ fontSize: 18 }}>📄</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{att.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--rc-text-tertiary)' }}>
                    {(att.size / 1024).toFixed(0)} KB
                  </div>
                </div>
              </a>
            )}
          </div>
        ))}
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
                  background: `linear-gradient(135deg, var(--rc-primary), var(--rc-primary-hover, #0066cc))`,
                  color: 'var(--rc-on-primary)',
                  boxShadow: '0 1px 4px rgba(0,127,255,0.15)',
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
        {/* Timestamp + read receipt */}
        {!isGrouped && (
          <div style={{
            fontSize: 10, color: isVisitor ? 'rgba(255,255,255,0.6)' : 'var(--rc-text-tertiary)', marginTop: 3,
            padding: '0 4px', textAlign: isVisitor ? 'right' : 'left',
            display: 'flex', alignItems: 'center', justifyContent: isVisitor ? 'flex-end' : 'flex-start', gap: 4,
          }}>
            <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {isVisitor && msg.status && (
              <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--rc-text-tertiary)' }}>
                <StatusIcon status={msg.status} />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// OFFLINE FORM
// ──────────────────────────────────────────────────────────
function OfflineFormView({ theme, t, onSubmit }: { theme: ThemeConfig; t: (k: string, vars?: Record<string, string>) => string; onSubmit: (d: any) => void }) {
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
function CsatView({ theme, t, onSubmit }: { theme: ThemeConfig; t: (k: string, vars?: Record<string, string>) => string; onSubmit: (rating: number, comment?: string) => void }) {
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
// SIGNAL BARS — Real-time audio quality indicator (like mobile signal)
// ──────────────────────────────────────────────────────────
function SignalBars({ signal, mos, t }: { signal: 1 | 2 | 3 | 4 | 5; mos?: number; t: (k: string, vars?: Record<string, string>) => string }) {
  const color = signal >= 4 ? 'var(--rc-success)' : signal === 3 ? 'var(--rc-warning)' : 'var(--rc-error)';
  const barHeights = [4, 7, 10, 13, 16];
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: 2,
      padding: '4px 6px', borderRadius: 8,
      background: 'rgba(0,0,0,0.06)',
    }}
      title={mos !== undefined ? `MOS: ${mos}/5.0` : t('call_audio_quality')}
    >
      {barHeights.map((h, i) => (
        <div key={i} style={{
          width: 3,
          height: h,
          borderRadius: 1.5,
          background: i < signal ? color : 'var(--rc-border)',
          transition: 'background 0.4s ease, height 0.3s ease',
        }} />
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// CALL TIMER — Elapsed time display
// ──────────────────────────────────────────────────────────
function CallTimer({ active }: { active: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) {
      startRef.current = Date.now();
      setElapsed(0);
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <span style={{
      fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
      color: 'var(--rc-text)', letterSpacing: '0.04em',
    }}>
      {display}
    </span>
  );
}

// ──────────────────────────────────────────────────────────
// QUALITY WARNING BANNER
// ──────────────────────────────────────────────────────────
function QualityWarningBanner({ warnings, t }: { warnings: string[]; t: (k: string, vars?: Record<string, string>) => string }) {
  if (warnings.length === 0) return null;

  const hasNoAudio = warnings.includes('no-audio');
  const hasLowMos = warnings.includes('low-mos');
  const hasSevere = hasLowMos || warnings.includes('high-packet-loss');

  return (
    <div className="rc-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      {/* Connection quality warning */}
      {!hasNoAudio && warnings.length > 0 && (
        <div style={{
          padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
          textAlign: 'center',
          background: hasSevere ? 'rgba(207,46,46,0.08)' : 'rgba(252,185,0,0.12)',
          color: hasSevere ? 'var(--rc-error)' : '#92400E',
          transition: 'all 0.3s ease',
        }}>
          {hasSevere ? t('call_connection_poor') : t('call_connection_unstable')}
        </div>
      )}
      {/* Mic/audio warning */}
      {hasNoAudio && (
        <div style={{
          padding: '8px 12px', borderRadius: 8, fontSize: 11, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(252,185,0,0.10)', color: '#92400E',
          transition: 'all 0.3s ease',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23"/>
            <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/>
            <path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .67-.1 1.32-.27 1.93"/>
            <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
          <span>{t('call_no_voice_detected')}</span>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// PHONE ICON SVG (reusable)
// ──────────────────────────────────────────────────────────
const PhoneIconSvg = ({ size = 28, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
  </svg>
);

// ──────────────────────────────────────────────────────────
// AUDIO WAVEFORM — CSS-only animated bars for connected state
// ──────────────────────────────────────────────────────────
function AudioWaveform() {
  const bars = [12, 18, 10, 20, 14, 16, 8];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, height: 24,
    }}>
      {bars.map((maxH, i) => (
        <div key={i} style={{
          width: 3, borderRadius: 1.5,
          background: 'rgba(16, 185, 129, 0.5)',
          animation: `rc-waveform-bar ${0.8 + (i * 0.15)}s ease-in-out infinite`,
          animationDelay: `${i * 0.1}s`,
          ['--rc-waveform-h' as string]: `${maxH}px`,
          minHeight: 4,
        }} />
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// INLINE CSAT — Stars rating for ended state
// ──────────────────────────────────────────────────────────
function InlineCsat({ onSubmit, t }: { onSubmit: (rating: number, comment?: string) => void; t: (k: string, vars?: Record<string, string>) => string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div style={{ textAlign: 'center', animation: 'rc-state-enter 0.35s var(--rc-ease-out-expo) forwards' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--rc-success)', margin: 0 }}>{t('call_csat_thanks')}</p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      animation: 'rc-state-enter 0.4s var(--rc-ease-out-expo) forwards',
      animationDelay: '0.6s', opacity: 0,
    }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--rc-text-secondary)', margin: 0 }}>
        {t('call_csat_question')}
      </p>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => { setRating(n); onSubmit(n); setSubmitted(true); }}
            onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 3,
              transition: 'transform 0.2s var(--rc-ease-spring)',
              transform: (hover >= n || rating >= n) ? 'scale(1.2)' : 'scale(1)',
              color: (hover >= n || rating >= n) ? '#FBBF24' : 'var(--rc-text-tertiary)',
            }}>
            {(hover >= n || rating >= n) ? I.star : I.starOutline}
          </button>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// CALL STATE TYPES
// ──────────────────────────────────────────────────────────
type CallViewState = 'idle' | 'preflight' | 'calling' | 'ringing' | 'queued' | 'connected' | 'on-hold' | 'ended' | 'error';

// ──────────────────────────────────────────────────────────
// CALL VIEW — Premium 9-state visual experience
// Inspired by 3CX, iOS Phone, Ramotion concepts
// ──────────────────────────────────────────────────────────
function CallView({ theme, t, callStatus, onRequestCall, onRequestWebRTCCall, onBack, sipState, isMuted, onToggleMute, onHangup, qualityMetrics, qualitySignal, qualityWarnings, queuePosition, estimatedWait, onHold, callEnded, callDuration, onSubmitCsat, onRetry }: {
  theme: ThemeConfig;
  t: (k: string, vars?: Record<string, string>) => string;
  callStatus: { callId?: string; status: string; message?: string };
  onRequestCall: (phone: string) => void;
  onRequestWebRTCCall?: () => void;
  onBack: () => void;
  sipState?: string;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onHangup?: () => void;
  qualityMetrics?: CallQualityMetrics | null;
  qualitySignal?: 1 | 2 | 3 | 4 | 5;
  qualityWarnings?: string[];
  queuePosition?: number;
  estimatedWait?: string;
  onHold?: boolean;
  callEnded?: boolean;
  callDuration?: number;
  onSubmitCsat?: (rating: number, comment?: string) => void;
  onRetry?: () => void;
}) {
  const [phone, setPhone] = useState('');
  const [preflightChecks, setPreflightChecks] = useState<boolean[]>([]);
  const [lastCallDuration, setLastCallDuration] = useState(0);
  const callTimerRef = useRef<number>(0);
  const preflightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive the visual state from all props
  const deriveState = useCallback((): CallViewState => {
    // Explicit ended state
    if (callEnded) return 'ended';
    // SIP ended
    if (sipState === 'ended') return 'ended';
    // On hold
    if (onHold && sipState === 'active') return 'on-hold';
    // Active call
    if (sipState === 'active') return 'connected';
    // SIP ringing
    if (sipState === 'ringing') return 'ringing';
    // SIP calling
    if (sipState === 'calling') return 'calling';
    // SIP registering = preflight
    if (sipState === 'registering') return 'preflight';
    // Server-side states
    if (callStatus.status === 'error') return 'error';
    if (callStatus.status === 'queued') return 'queued';
    if (callStatus.status === 'ringing') return 'ringing';
    if (callStatus.status === 'requesting') return 'calling';
    return 'idle';
  }, [sipState, callStatus.status, callEnded, onHold]);

  const state = deriveState();

  // Track call duration for ended state display
  useEffect(() => {
    if (state === 'connected') {
      callTimerRef.current = Date.now();
    } else if (state === 'ended' && callTimerRef.current > 0) {
      setLastCallDuration(callDuration ?? Math.floor((Date.now() - callTimerRef.current) / 1000));
      callTimerRef.current = 0;
    }
  }, [state, callDuration]);

  // Preflight check simulation (sequential checkmarks)
  useEffect(() => {
    if (state === 'preflight') {
      setPreflightChecks([]);
      const steps = [500, 900, 1300];
      steps.forEach((delay, i) => {
        preflightTimerRef.current = setTimeout(() => {
          setPreflightChecks(prev => { const next = [...prev]; next[i] = true; return next; });
        }, delay);
      });
    }
    return () => {
      if (preflightTimerRef.current) clearTimeout(preflightTimerRef.current);
    };
  }, [state]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.replace(/[^\d+]/g, '').length >= 6) {
      onRequestCall(phone);
    }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // ─── Render the phone icon area based on state ───
  const renderPhoneIcon = () => {
    const baseSize = 72;
    const baseStyle: React.CSSProperties = {
      width: baseSize, height: baseSize, borderRadius: baseSize / 2,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', transition: 'all 0.4s var(--rc-ease-out-expo)',
    };

    switch (state) {
      case 'idle':
        return (
          <div style={{
            ...baseStyle, width: 80, height: 80, borderRadius: 40,
            background: `linear-gradient(135deg, ${theme.colors.gradientFrom}12, ${theme.colors.gradientTo}18)`,
            color: 'var(--rc-primary)',
          }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: `linear-gradient(90deg, transparent, ${theme.colors.gradientFrom}10, transparent)`,
              backgroundSize: '200% 100%',
              animation: 'rc-gradient-shimmer 3s ease-in-out infinite',
            }} />
            <PhoneIconSvg size={30} />
          </div>
        );

      case 'preflight':
        return (
          <div style={{ ...baseStyle, background: `${theme.colors.gradientFrom}10`, color: 'var(--rc-primary)' }}>
            {/* Circular spinner around icon */}
            <svg style={{
              position: 'absolute', inset: -6, width: baseSize + 12, height: baseSize + 12,
              animation: 'rc-circular-spin 1.5s linear infinite',
            }} viewBox="0 0 84 84">
              <circle cx="42" cy="42" r="40" fill="none" stroke="var(--rc-border)" strokeWidth="2" />
              <circle cx="42" cy="42" r="40" fill="none" stroke="var(--rc-primary)" strokeWidth="2.5"
                strokeDasharray="62 189" strokeLinecap="round" />
            </svg>
            <PhoneIconSvg size={26} />
          </div>
        );

      case 'calling':
        return (
          <div style={{ ...baseStyle, background: `linear-gradient(135deg, #3B82F612, #1D4ED812)`, color: '#3B82F6' }}>
            {/* Expanding rings */}
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '2px solid #3B82F6',
                animation: 'rc-ring-expand 2s ease-out infinite',
                animationDelay: `${i * 0.6}s`,
                opacity: 0,
              }} />
            ))}
            <PhoneIconSvg size={28} />
          </div>
        );

      case 'ringing':
        return (
          <div style={{ ...baseStyle, background: `linear-gradient(135deg, #3B82F615, #6366F115)`, color: '#3B82F6' }}>
            <div style={{ animation: 'rc-phone-shake 0.8s ease-in-out infinite', display: 'flex' }}>
              <PhoneIconSvg size={28} />
            </div>
          </div>
        );

      case 'queued':
        return (
          <div style={{ ...baseStyle, background: 'linear-gradient(135deg, #F59E0B12, #D9770612)', color: '#D97706' }}>
            <PhoneIconSvg size={28} />
            {/* Queue position badge */}
            {queuePosition !== undefined && (
              <div style={{
                position: 'absolute', top: -4, right: -4,
                width: 26, height: 26, borderRadius: 13,
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                color: 'white', fontSize: 12, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(245,158,11,0.35)',
                border: '2px solid var(--rc-bg)',
              }}>
                {queuePosition}
              </div>
            )}
          </div>
        );

      case 'connected':
        return (
          <div style={{
            ...baseStyle,
            background: 'linear-gradient(135deg, #10B981, #059669)',
            color: 'white',
            animation: 'rc-connected-glow 2.5s ease-in-out infinite',
          }}>
            <PhoneIconSvg size={28} />
          </div>
        );

      case 'on-hold':
        return (
          <div style={{
            ...baseStyle,
            background: 'linear-gradient(135deg, #F59E0B18, #92400E10)',
            color: '#92400E',
          }}>
            <PhoneIconSvg size={28} />
            {/* Pause overlay */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(245,158,11,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 24, height: 24, borderRadius: 12,
                background: '#F59E0B', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(245,158,11,0.3)',
                border: '2px solid var(--rc-bg)',
              }}>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="white">
                  <rect x="1" y="1" width="3.5" height="10" rx="1" />
                  <rect x="7.5" y="1" width="3.5" height="10" rx="1" />
                </svg>
              </div>
            </div>
            {/* Music note floating */}
            <div style={{
              position: 'absolute', top: -8, left: -4,
              fontSize: 16, animation: 'rc-music-pulse 1.5s ease-in-out infinite',
              opacity: 0.6,
            }}>
              ♪
            </div>
            <div style={{
              position: 'absolute', top: -4, right: -8,
              fontSize: 12, animation: 'rc-music-pulse 1.8s ease-in-out infinite',
              animationDelay: '0.4s', opacity: 0.4,
            }}>
              ♫
            </div>
          </div>
        );

      case 'ended':
        return (
          <div style={{
            ...baseStyle,
            background: 'linear-gradient(135deg, #10B98118, #05966910)',
            color: '#10B981',
          }}>
            {/* Animated checkmark */}
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
              stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"
                style={{
                  strokeDasharray: 36, strokeDashoffset: 36,
                  animation: 'rc-checkmark-draw 0.5s ease-out 0.2s forwards',
                }} />
            </svg>
          </div>
        );

      case 'error':
        return (
          <div style={{
            ...baseStyle,
            background: 'linear-gradient(135deg, #EF444412, #DC262610)',
            color: 'var(--rc-error)',
          }}>
            {/* Animated X mark */}
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="var(--rc-error)" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"
                style={{
                  strokeDasharray: 17, strokeDashoffset: 17,
                  animation: 'rc-x-draw 0.35s ease-out 0.15s forwards',
                }} />
              <line x1="6" y1="6" x2="18" y2="18"
                style={{
                  strokeDasharray: 17, strokeDashoffset: 17,
                  animation: 'rc-x-draw 0.35s ease-out 0.3s forwards',
                }} />
            </svg>
          </div>
        );
    }
  };

  // ─── State-specific content below the icon ───
  const renderStateContent = () => {
    switch (state) {
      case 'preflight': {
        const steps = [t('call_preflight_mic'), t('call_preflight_connection'), t('call_preflight_server')];
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 200 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--rc-text)', margin: '0 0 4px', textAlign: 'center' }}>
              {t('call_preflight_verifying')}
            </p>
            {steps.map((step, i) => (
              <div key={step} style={{
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 500,
                color: preflightChecks[i] ? 'var(--rc-success)' : 'var(--rc-text-tertiary)',
                animation: preflightChecks[i] ? 'rc-preflight-step 0.3s var(--rc-ease-out-expo) forwards' : 'none',
                transition: 'color 0.3s ease',
              }}>
                {preflightChecks[i] ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--rc-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <div style={{
                    width: 14, height: 14, borderRadius: 7,
                    border: '2px solid var(--rc-border)',
                    flexShrink: 0,
                  }} />
                )}
                {step}
              </div>
            ))}
          </div>
        );
      }

      case 'calling':
        return (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--rc-text)', margin: 0 }}>
              {t('call_calling')}
            </p>
            <p style={{ fontSize: 12, color: 'var(--rc-text-secondary)', margin: 0, fontWeight: 500 }}>
              {t('call_please_wait')}
            </p>
          </>
        );

      case 'ringing':
        return (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--rc-text)', margin: 0 }}>
              {t('call_connecting')}
            </p>
            <p style={{ fontSize: 12, color: 'var(--rc-text-secondary)', margin: 0, fontWeight: 500 }}>
              {callStatus.status === 'ringing'
                ? t('call_will_receive')
                : t('call_establishing')}
            </p>
          </>
        );

      case 'queued':
        return (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--rc-text)', margin: 0 }}>
              {t('call_queued')}
            </p>
            <p style={{ fontSize: 12, color: 'var(--rc-text-secondary)', margin: 0, fontWeight: 500, lineHeight: 1.5 }}>
              {queuePosition !== undefined && t('call_queue_position', { position: String(queuePosition) })}
              {queuePosition !== undefined && estimatedWait && ' — '}
              {estimatedWait && t('call_estimated_wait', { time: estimatedWait })}
            </p>
            {/* Animated progress dots */}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: '#F59E0B',
                  animation: 'rc-queue-pulse 1.2s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </div>
          </>
        );

      case 'connected':
        return (
          <>
            {/* Signal bars — top right */}
            {qualitySignal !== undefined && (
              <div style={{ position: 'absolute', top: 16, right: 20 }}>
                <SignalBars signal={qualitySignal} mos={qualityMetrics?.mos} t={t} />
              </div>
            )}
            <CallTimer active={true} />
            <p style={{ fontSize: 12, color: 'var(--rc-text-secondary)', margin: 0, fontWeight: 500 }}>
              {t('call_in_progress')}
            </p>
            {/* Waveform visualization */}
            <AudioWaveform />
            {/* Quality warnings */}
            {qualityWarnings && qualityWarnings.length > 0 && (
              <QualityWarningBanner warnings={qualityWarnings} t={t} />
            )}
            {/* Call controls — mute + hangup */}
            <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
              {onToggleMute && (
                <button onClick={onToggleMute} style={{
                  width: 48, height: 48, borderRadius: 24, border: 'none',
                  background: isMuted ? 'var(--rc-error)' : 'var(--rc-surface)',
                  color: isMuted ? 'white' : 'var(--rc-text)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  boxShadow: 'var(--rc-shadow-sm)',
                }}
                  title={isMuted ? t('call_unmute_mic') : t('call_mute_mic')}
                >
                  {isMuted ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="1" y1="1" x2="23" y2="23"/>
                      <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/>
                      <path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .67-.1 1.32-.27 1.93"/>
                      <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                      <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                      <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                  )}
                </button>
              )}
              {onHangup && (
                <button onClick={onHangup} style={{
                  width: 48, height: 48, borderRadius: 24, border: 'none',
                  background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                  color: 'white',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(239,68,68,0.3)',
                }}
                  title={t('call_hangup')}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.11 2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91"/>
                    <line x1="23" y1="1" x2="1" y2="23"/>
                  </svg>
                </button>
              )}
            </div>
          </>
        );

      case 'on-hold':
        return (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#92400E', margin: 0 }}>
              {t('call_on_hold')}
            </p>
            <p style={{ fontSize: 12, color: 'var(--rc-text-tertiary)', margin: 0, fontWeight: 500 }}>
              {t('call_agent_soon')}
            </p>
            {/* Hangup still available */}
            {onHangup && (
              <button onClick={onHangup} style={{
                width: 48, height: 48, borderRadius: 24, border: 'none',
                background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                color: 'white', marginTop: 8,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(239,68,68,0.3)',
              }}
                title={t('call_hangup')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.11 2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91"/>
                  <line x1="23" y1="1" x2="1" y2="23"/>
                </svg>
              </button>
            )}
          </>
        );

      case 'ended': {
        const duration = callDuration ?? lastCallDuration;
        return (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--rc-text)', margin: 0 }}>
              {t('call_ended')}
            </p>
            {duration > 0 && (
              <p style={{
                fontSize: 20, fontWeight: 700, color: 'var(--rc-text-secondary)',
                margin: 0, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em',
              }}>
                {formatDuration(duration)}
              </p>
            )}
            {/* Inline CSAT */}
            {onSubmitCsat && (
              <InlineCsat onSubmit={onSubmitCsat} t={t} />
            )}
          </>
        );
      }

      case 'error':
        return (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--rc-error)', margin: 0 }}>
              {t('call_error')}
            </p>
            {callStatus.message && (
              <p style={{
                fontSize: 12, color: 'var(--rc-text-secondary)', margin: 0,
                padding: '6px 12px', borderRadius: 8,
                background: 'rgba(207,46,46,0.06)', fontWeight: 500,
                maxWidth: '100%', textAlign: 'center', lineHeight: 1.4,
              }}>
                {callStatus.message}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {onRetry && (
                <button onClick={onRetry} style={{
                  padding: '10px 20px', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, var(--rc-primary), var(--rc-primary-hover, #0066cc))',
                  color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,127,255,0.25)',
                  transition: 'all 0.2s ease',
                }}>
                  {t('call_retry')}
                </button>
              )}
              <button onClick={onBack} style={{
                padding: '10px 20px', borderRadius: 12,
                border: '1.5px solid var(--rc-border)', background: 'var(--rc-bg)',
                color: 'var(--rc-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}>
                {t('call_use_callback')}
              </button>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  const [callMode, setCallMode] = useState<'choose' | 'callback'>('choose');

  // ─── IDLE STATE: Choose call mode (WebRTC browser or callback) ───
  if (state === 'idle') {
    // Mode selection screen
    if (callMode === 'choose') {
      return (
        <div style={{
          padding: '32px 28px', textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          animation: 'rc-state-enter 0.4s var(--rc-ease-out-expo) forwards',
        }}>
          {renderPhoneIcon()}

          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--rc-text)', marginBottom: 4 }}>
              {t('call_how_to_call')}
            </p>
            <p style={{ fontSize: 12, color: 'var(--rc-text-tertiary)', lineHeight: 1.5 }}>
              {t('call_choose_mode')}
            </p>
          </div>

          {/* Browser call button (WebRTC via Janus) */}
          {onRequestWebRTCCall && (
            <button onClick={onRequestWebRTCCall} style={{
              width: '100%', padding: '14px 16px', borderRadius: 14, border: 'none',
              background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`,
              color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(0,127,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'all 0.25s',
            }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              {t('call_from_browser')}
            </button>
          )}

          {/* Callback button */}
          <button onClick={() => setCallMode('callback')} style={{
            width: '100%', padding: '14px 16px', borderRadius: 14,
            border: '1.5px solid var(--rc-border)', background: 'var(--rc-surface)',
            color: 'var(--rc-text)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'all 0.25s',
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--rc-primary)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--rc-border)')}
          >
            {I.phone}
            {t('call_callback_me')}
          </button>

          <button onClick={onBack} style={{
            fontSize: 12, color: 'var(--rc-text-tertiary)', background: 'none',
            border: 'none', cursor: 'pointer', fontWeight: 500, transition: 'color 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--rc-text-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--rc-text-tertiary)')}
          >
            {t('call_back_to_chat')}
          </button>
        </div>
      );
    }

    // Callback phone form (existing flow)
    return (
      <div style={{
        padding: '32px 28px', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        animation: 'rc-state-enter 0.4s var(--rc-ease-out-expo) forwards',
      }}>
        {renderPhoneIcon()}

        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--rc-text)', marginBottom: 4 }}>
            {t('call_we_call_you')}
          </p>
          <p style={{ fontSize: 12, color: 'var(--rc-text-tertiary)', lineHeight: 1.5 }}>
            {t('call_enter_phone')}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              fontSize: 16, color: 'var(--rc-text-secondary)', display: 'flex',
            }}>
              {I.phone}
            </span>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+34 600 000 000"
              autoFocus
              required
              style={{
                width: '100%', padding: '12px 14px 12px 42px', borderRadius: 14,
                border: '1.5px solid var(--rc-border)', background: 'var(--rc-surface)',
                fontSize: 15, color: 'var(--rc-text)', outline: 'none',
                transition: 'border-color 0.2s',
                fontFamily: 'inherit',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--rc-primary)')}
              onBlur={e => (e.target.style.borderColor = 'var(--rc-border)')}
            />
          </div>
          <button type="submit" disabled={phone.replace(/[^\d+]/g, '').length < 6} style={{
            width: '100%', padding: '12px', borderRadius: 14, border: 'none',
            background: phone.replace(/[^\d+]/g, '').length >= 6
              ? `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientTo})`
              : 'var(--rc-surface)',
            color: phone.replace(/[^\d+]/g, '').length >= 6 ? 'white' : 'var(--rc-text-tertiary)',
            fontSize: 14, fontWeight: 600, cursor: phone.replace(/[^\d+]/g, '').length >= 6 ? 'pointer' : 'default',
            boxShadow: phone.replace(/[^\d+]/g, '').length >= 6 ? '0 2px 10px rgba(0,127,255,0.25)' : 'none',
            transition: 'all 0.25s',
          }}>
            {t('call_call_me_now')}
          </button>
        </form>

        <div style={{ display: 'flex', gap: 16 }}>
          <button onClick={() => setCallMode('choose')} style={{
            fontSize: 12, color: 'var(--rc-text-tertiary)', background: 'none',
            border: 'none', cursor: 'pointer', fontWeight: 500, transition: 'color 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--rc-text-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--rc-text-tertiary)')}
          >
            {t('call_back')}
          </button>
          <button onClick={onBack} style={{
            fontSize: 12, color: 'var(--rc-text-tertiary)', background: 'none',
            border: 'none', cursor: 'pointer', fontWeight: 500, transition: 'color 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--rc-text-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--rc-text-tertiary)')}
          >
            {t('call_back_to_chat')}
          </button>
        </div>
      </div>
    );
  }

  // ─── ALL OTHER STATES: Unified layout ───
  return (
    <div style={{
      padding: '24px 28px', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      position: 'relative',
      animation: 'rc-state-enter 0.4s var(--rc-ease-out-expo) forwards',
    }}
      key={state} // Force re-mount on state change for animation
    >
      {renderPhoneIcon()}
      {renderStateContent()}

      {/* Back to chat link — shown on non-error states (error has its own buttons) */}
      {state !== 'error' && (
        <button onClick={onBack} style={{
          fontSize: 12, color: 'var(--rc-text-tertiary)', background: 'none',
          border: 'none', cursor: 'pointer', fontWeight: 500, transition: 'color 0.15s',
          marginTop: 4,
        }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--rc-text-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--rc-text-tertiary)')}
        >
          {t('call_back_to_chat')}
        </button>
      )}
    </div>
  );
}
