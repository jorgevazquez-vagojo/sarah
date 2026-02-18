import { ThemeConfig } from './types';

export function applyTheme(theme: ThemeConfig, root: HTMLElement) {
  const { colors, typography, layout } = theme;
  const s = root.style;

  // Colors
  s.setProperty('--rc-primary', colors.primary);
  s.setProperty('--rc-primary-dark', colors.primaryDark);
  s.setProperty('--rc-primary-light', colors.primaryLight);
  s.setProperty('--rc-secondary', colors.secondary);
  s.setProperty('--rc-accent', colors.accent);
  s.setProperty('--rc-bg', colors.background);
  s.setProperty('--rc-surface', colors.surface);
  s.setProperty('--rc-text', colors.text);
  s.setProperty('--rc-text-secondary', colors.textSecondary);
  s.setProperty('--rc-text-on-primary', colors.textOnPrimary);
  s.setProperty('--rc-border', colors.border);
  s.setProperty('--rc-success', colors.success);
  s.setProperty('--rc-warning', colors.warning);
  s.setProperty('--rc-error', colors.error);
  s.setProperty('--rc-gradient-from', colors.gradientFrom);
  s.setProperty('--rc-gradient-to', colors.gradientTo);

  // Typography
  s.setProperty('--rc-font', typography.fontFamily);
  s.setProperty('--rc-font-size', `${typography.fontSize}px`);
  s.setProperty('--rc-header-font-size', `${typography.headerFontSize}px`);

  // Layout
  s.setProperty('--rc-width', `${layout.width}px`);
  s.setProperty('--rc-max-height', `${layout.maxHeight}px`);
  s.setProperty('--rc-radius', `${layout.borderRadius}px`);
  s.setProperty('--rc-btn-size', `${layout.buttonSize}px`);
  s.setProperty('--rc-btn-radius', `${layout.buttonBorderRadius}px`);
  s.setProperty('--rc-header-height', `${layout.headerHeight}px`);
  s.setProperty('--rc-z', `${layout.zIndex}`);
}

export const DEFAULT_THEME: ThemeConfig = {
  branding: { companyName: 'Redegal', logoUrl: '', faviconUrl: '', poweredByText: 'Powered by Redegal', showPoweredBy: true },
  colors: {
    primary: '#E30613', primaryDark: '#B8050F', primaryLight: '#FEE2E2',
    secondary: '#1E293B', accent: '#F59E0B',
    background: '#FFFFFF', surface: '#F8FAFC', text: '#0F172A',
    textSecondary: '#64748B', textOnPrimary: '#FFFFFF', border: '#E2E8F0',
    success: '#10B981', warning: '#F59E0B', error: '#EF4444',
    gradientFrom: '#E30613', gradientTo: '#B8050F', headerGradient: true,
  },
  typography: { fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: 14, headerFontSize: 16, messagesFontSize: 14 },
  layout: { position: 'bottom-right', offsetX: 20, offsetY: 20, width: 400, maxHeight: 650, borderRadius: 16, buttonSize: 60, buttonBorderRadius: 30, headerHeight: 64, zIndex: 2147483647, mobileFullscreen: true },
  features: {
    enableVoip: true, enableFileUpload: true, enableEmoji: true, enableCsat: true,
    enableLeadForm: true, enableQuickReplies: true, enableRichMessages: true,
    enableSoundNotifications: true, enableReadReceipts: true, enableTypingIndicator: true,
    enableLanguageSelector: true, enableBusinessLines: true, enableDarkMode: false,
    enableAttachments: true, maxFileSize: 10485760,
    allowedFileTypes: ['image/*', 'application/pdf', '.doc', '.docx', '.xls', '.xlsx'],
  },
  i18n: { defaultLanguage: 'es', availableLanguages: ['es', 'en', 'pt', 'fr', 'de', 'it', 'nl', 'zh', 'ja', 'ko', 'ar', 'gl'], autoDetect: true },
  businessLines: [
    { id: 'boostic', icon: 'chart-line', color: '#3B82F6' },
    { id: 'binnacle', icon: 'chart-bar', color: '#8B5CF6' },
    { id: 'marketing', icon: 'megaphone', color: '#10B981' },
    { id: 'tech', icon: 'code', color: '#F59E0B' },
  ],
  businessHours: { timezone: 'Europe/Madrid', schedule: [{ days: [1, 2, 3, 4, 5], start: '09:00', end: '19:00' }], holidays: [] },
  messages: { welcomeDelay: 1000, typingDelay: 500, autoGreet: true, autoGreetDelay: 3000, inactivityTimeout: 1800 },
  sounds: { newMessage: 'notification', agentJoined: 'chime', callRinging: 'ring' },
};
