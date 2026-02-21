// ~3KB lightweight bootstrap — loads the full widget async
(function () {
  const cfg = (window as any).RdgBot || {};
  const baseUrl = cfg.baseUrl || '';

  // Create Shadow DOM container
  const host = document.createElement('div');
  host.id = 'rdgbot-host';
  host.style.cssText = 'position:fixed;bottom:0;right:0;z-index:2147483647;';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  // Load CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `${baseUrl}/widget.css`;
  shadow.appendChild(link);

  // Mount point
  const mount = document.createElement('div');
  mount.id = 'rdgbot-root';
  shadow.appendChild(mount);

  // Load widget JS
  const script = document.createElement('script');
  script.src = `${baseUrl}/widget.js`;
  script.onload = () => {
    const init = (window as any).__rdgbotInit;
    if (init) init(mount, cfg);
  };
  document.head.appendChild(script);
})();
