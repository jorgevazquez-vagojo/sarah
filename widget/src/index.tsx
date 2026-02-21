import React from 'react';
import ReactDOM from 'react-dom/client';
import { Widget } from './Widget';
import './styles.css';

// IIFE: global init function for Shadow DOM mounting
(window as any).__rdgbotInit = function (mountEl: HTMLElement, config: any) {
  const root = ReactDOM.createRoot(mountEl);
  root.render(
    <React.StrictMode>
      <Widget
        baseUrl={config.baseUrl}
        apiUrl={config.apiUrl}
        configUrl={config.configUrl}
        language={config.language}
        primaryColor={config.primaryColor}
        theme={config.theme}
      />
    </React.StrictMode>
  );
};

// Auto-init if dev mode
const el = document.getElementById('rdgbot-root');
if (el) {
  (window as any).__rdgbotInit(el, (window as any).RdgBot || {});
}
