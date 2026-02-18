import React from 'react';
import ReactDOM from 'react-dom/client';
import { Widget } from './Widget';
import './styles.css';

// For IIFE build: expose init function globally
(window as any).__redegalWidgetInit = function (mountEl: HTMLElement, config: any) {
  const root = ReactDOM.createRoot(mountEl);
  root.render(
    <React.StrictMode>
      <Widget
        baseUrl={config.baseUrl}
        apiUrl={config.apiUrl}
        language={config.language}
        primaryColor={config.primaryColor}
      />
    </React.StrictMode>
  );
};

// Auto-init if mount point already exists (dev mode)
const existing = document.getElementById('redegal-chatbot-root');
if (existing) {
  const config = (window as any).RedegalChatbot || {};
  (window as any).__redegalWidgetInit(existing, config);
}
