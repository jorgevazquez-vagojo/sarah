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
  branding: {
    companyName: 'Redegal',
    logoUrl: 'https://www.redegal.com/wp-content/uploads/2025/05/Logo-Redegal.svg',
    faviconUrl: '',
    poweredByText: 'Redegal \u00b7 A Smart Digital Company',
    showPoweredBy: true,
  },
  colors: {
    // Redegal brand blue (#007fff) with corporate palette matching redegal.com
    primary: '#007fff',
    primaryDark: '#0066cc',
    primaryLight: '#E0F0FF',
    secondary: '#32373c',
    accent: '#0693e3',
    background: '#FFFFFF',
    surface: '#F7F9FC',
    text: '#1A1A2E',
    textSecondary: '#5A6178',
    textOnPrimary: '#FFFFFF',
    border: '#E5E9F0',
    success: '#00D084',
    warning: '#FCB900',
    error: '#CF2E2E',
    gradientFrom: '#007fff',
    gradientTo: '#0055CC',
    headerGradient: true,
  },
  typography: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    fontSize: 14,
    headerFontSize: 16,
    messagesFontSize: 14,
  },
  layout: {
    position: 'bottom-right',
    offsetX: 24,
    offsetY: 24,
    width: 400,
    maxHeight: 640,
    borderRadius: 20,
    buttonSize: 60,
    buttonBorderRadius: 30,
    headerHeight: 68,
    zIndex: 2147483647,
    mobileFullscreen: true,
  },
  features: {
    enableVoip: true,
    enableFileUpload: true,
    enableEmoji: true,
    enableCsat: true,
    enableLeadForm: true,
    enableQuickReplies: true,
    enableRichMessages: true,
    enableSoundNotifications: true,
    enableReadReceipts: true,
    enableTypingIndicator: true,
    enableLanguageSelector: true,
    enableBusinessLines: true,
    enableDarkMode: false,
    enableAttachments: true,
    maxFileSize: 10485760,
    allowedFileTypes: ['image/*', 'application/pdf', '.doc', '.docx', '.xls', '.xlsx'],
  },
  i18n: { defaultLanguage: 'es', availableLanguages: ['es', 'en', 'pt', 'gl'], autoDetect: true },
  businessLines: [
    { id: 'boostic', icon: 'chart-line', color: '#007fff' },
    { id: 'binnacle', icon: 'chart-bar', color: '#0693e3' },
    { id: 'marketing', icon: 'megaphone', color: '#00D084' },
    { id: 'tech', icon: 'code', color: '#32373c' },
  ],
  businessHours: { timezone: 'Europe/Madrid', schedule: [{ days: [1, 2, 3, 4, 5], start: '09:00', end: '19:00' }], holidays: [] },
  messages: { welcomeDelay: 800, typingDelay: 400, autoGreet: true, autoGreetDelay: 5000, inactivityTimeout: 1800 },
  sounds: { newMessage: 'notification', agentJoined: 'chime', callRinging: 'ring' },
};
