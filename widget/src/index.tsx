import React from 'react';
import ReactDOM from 'react-dom/client';
import { Widget } from './Widget';
import './styles.css';

// IIFE: global init function for Shadow DOM mounting
(window as any).__sarahInit = function (mountEl: HTMLElement, config: any) {
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

// Backward compatibility alias
(window as any).__rdgbotInit = (window as any).__sarahInit;

// Auto-init if dev mode
const el = document.getElementById('sarah-root') || document.getElementById('rdgbot-root');
if (el) {
  (window as any).__sarahInit(el, (window as any).Sarah || (window as any).RdgBot || {});
}
