(function(){
  var cfg = window.redegalSarahConfig || {};
  if (!cfg) return;

  var origin = window.location.origin;
  var wsProto = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  var wsOrigin = wsProto + window.location.host;

  var isTunnel = window.location.port === '' && window.location.hostname !== 'localhost';
  var chatHost;
  var wsHost;

  if (cfg.serverMode === 'custom' && cfg.serverCustom) {
    chatHost = cfg.serverCustom;
    wsHost = chatHost.replace(/^https?/, wsProto.replace('://', '')) + '/ws/chat';
  } else {
    chatHost = isTunnel ? origin + '/chat-api' : window.location.protocol + '//' + window.location.hostname + ':9456';
    wsHost = isTunnel ? wsOrigin + '/ws' : wsProto + window.location.hostname + ':9456/ws';
  }

  window.Sarah = {
    baseUrl:   isTunnel ? origin + '/widget' : chatHost + '/widget',
    apiUrl:    wsHost + '/chat',
    configUrl: chatHost + '/api/config/widget',
    language:  'auto',
    primaryColor: cfg.primaryColor || '#007fff',
    theme: {
      branding: {
        companyName: 'Redegal',
        botName: cfg.botName || 'Sarah',
        welcomeMessage: cfg.welcome || 'Hola! Bienvenido a Redegal.',
        offlineMessage: cfg.offline || 'Ahora mismo estamos offline.',
        poweredByText: 'Powered by Redegal AI',
        showPoweredBy: true
      },
      colors: {
        primary: cfg.primaryColor || '#007fff',
        primaryDark: '#0066cc',
        primaryLight: '#E0F0FF',
        gradientFrom: cfg.primaryColor || '#007fff',
        gradientTo: '#0055CC'
      },
      layout: {
        position: cfg.position || 'bottom-right',
        offsetX: 20,
        offsetY: 20,
        zIndex: 2147483647
      },
      features: {
        enableVoip: !!cfg.enableVoip,
        enableFileUpload: true,
        enableEmoji: true,
        enableCsat: true,
        enableLeadForm: !!cfg.enableLead,
        enableQuickReplies: true,
        enableRichMessages: true,
        enableSoundNotifications: true,
        enableLanguageSelector: true,
        enableBusinessLines: true
      },
      i18n: {
        defaultLanguage: 'es',
        availableLanguages: ['es', 'en', 'pt', 'gl'],
        autoDetect: true
      },
      businessLines: [
        { id: 'boostic',  icon: 'chart-line', color: '#3B82F6' },
        { id: 'binnacle', icon: 'chart-bar',  color: '#8B5CF6' },
        { id: 'marketing',icon: 'megaphone',  color: '#10B981' },
        { id: 'tech',     icon: 'code',       color: '#F59E0B' }
      ]
    }
  };
  window.RdgBot = window.Sarah;
})();
