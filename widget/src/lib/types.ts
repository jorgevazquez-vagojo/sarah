// ─── Theme Configuration (fully parametrizable) ───
export interface ThemeConfig {
  branding: {
    companyName: string;
    logoUrl: string;
    faviconUrl: string;
    poweredByText: string;
    showPoweredBy: boolean;
  };
  colors: {
    primary: string;
    primaryDark: string;
    primaryLight: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    textOnPrimary: string;
    border: string;
    success: string;
    warning: string;
    error: string;
    gradientFrom: string;
    gradientTo: string;
    headerGradient: boolean;
  };
  typography: {
    fontFamily: string;
    fontSize: number;
    headerFontSize: number;
    messagesFontSize: number;
  };
  layout: {
    position: 'bottom-right' | 'bottom-left';
    offsetX: number;
    offsetY: number;
    width: number;
    maxHeight: number;
    borderRadius: number;
    buttonSize: number;
    buttonBorderRadius: number;
    headerHeight: number;
    zIndex: number;
    mobileFullscreen: boolean;
  };
  features: {
    enableVoip: boolean;
    enableFileUpload: boolean;
    enableEmoji: boolean;
    enableCsat: boolean;
    enableLeadForm: boolean;
    enableQuickReplies: boolean;
    enableRichMessages: boolean;
    enableSoundNotifications: boolean;
    enableReadReceipts: boolean;
    enableTypingIndicator: boolean;
    enableLanguageSelector: boolean;
    enableBusinessLines: boolean;
    enableDarkMode: boolean;
    enableAttachments: boolean;
    maxFileSize: number;
    allowedFileTypes: string[];
  };
  i18n: {
    defaultLanguage: string;
    availableLanguages: string[];
    autoDetect: boolean;
  };
  businessLines: BusinessLineConfig[];
  businessHours: {
    timezone: string;
    schedule: { days: number[]; start: string; end: string }[];
    holidays: string[];
  };
  messages: {
    welcomeDelay: number;
    typingDelay: number;
    autoGreet: boolean;
    autoGreetDelay: number;
    inactivityTimeout: number;
  };
  sounds: {
    newMessage: string;
    agentJoined: string;
    callRinging: string;
  };
}

export interface BusinessLineConfig {
  id: string;
  icon: string;
  color: string;
}

// ─── Message Types ───
export interface ChatMessage {
  id?: string;
  sender: 'visitor' | 'bot' | 'agent' | 'system';
  content: string;
  messageType: 'text' | 'image' | 'file' | 'card' | 'carousel' | 'buttons' | 'quick_reply' | 'system';
  richContent?: RichContent;
  attachments?: Attachment[];
  agentName?: string;
  agentAvatar?: string;
  timestamp: string;
  readAt?: string;
}

export interface RichContent {
  // Card
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  buttons?: RichButton[];
  // Carousel
  cards?: RichContent[];
  // Quick replies
  quickReplies?: string[];
}

export interface RichButton {
  label: string;
  action: 'url' | 'postback' | 'call' | 'email';
  value: string;
}

export interface Attachment {
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

export type WidgetView = 'closed' | 'welcome' | 'chat' | 'call' | 'lead_form' | 'offline_form' | 'csat';
