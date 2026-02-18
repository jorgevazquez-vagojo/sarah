import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createAgentWS } from '../api/client';
import { QueueView } from './QueueView';
import { ConversationPanel } from './ConversationPanel';
import { AgentStatus } from './AgentStatus';
import { LeadsList } from './LeadsList';
import { Analytics } from './Analytics';
import { Settings } from './Settings';

interface Props {
  token: string;
  agent: any;
  onLogout: () => void;
}

export interface QueueItem {
  conversationId: string;
  visitorId: string;
  language: string;
  businessLine: string;
  lastMessage?: string;
  createdAt?: string;
  waitTime?: number;
}

export interface Message {
  sender: string;
  content: string;
  timestamp: string;
  metadata?: any;
}

type Tab = 'queue' | 'leads' | 'analytics' | 'settings';

const NAV_ITEMS: { id: Tab; label: string; iconPath: string }[] = [
  { id: 'queue', label: 'Conversaciones', iconPath: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { id: 'leads', label: 'Leads', iconPath: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75' },
  { id: 'analytics', label: 'Analytics', iconPath: 'M18 20V10 M12 20V4 M6 20v-6' },
  { id: 'settings', label: 'Ajustes', iconPath: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' },
];

const TAB_TITLES: Record<Tab, string> = {
  queue: 'Conversaciones',
  leads: 'Leads',
  analytics: 'Analytics',
  settings: 'Ajustes',
};

const TAB_SUBTITLES: Record<Tab, string> = {
  queue: 'Gestiona chats en tiempo real',
  leads: 'Pipeline de contactos comerciales',
  analytics: 'Metricas y rendimiento',
  settings: 'Configuracion del sistema',
};

export function Dashboard({ token, agent, onLogout }: Props) {
  const [tab, setTab] = useState<Tab>('queue');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [activeConvData, setActiveConvData] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState(agent?.status || 'online');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showCmdPalette, setShowCmdPalette] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Dark mode
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCmdPalette((v) => !v);
      }
      if (e.key === 'Escape') setShowCmdPalette(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const sendWS = useCallback((type: string, data: Record<string, any> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...data }));
    }
  }, []);

  useEffect(() => {
    let reconnectTimer: number;
    const connect = () => {
      const ws = createAgentWS(token);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'queue':
            setQueue(msg.conversations.map((c: any) => ({
              conversationId: c.id,
              visitorId: c.visitor_id,
              language: c.language,
              businessLine: c.business_line,
              lastMessage: c.last_message,
              createdAt: c.created_at,
            })));
            break;
          case 'queue_new':
            setQueue((prev) => [...prev, {
              conversationId: msg.conversationId,
              visitorId: msg.visitorId,
              language: msg.language,
              businessLine: msg.businessLine,
              createdAt: new Date().toISOString(),
            }]);
            if (tab !== 'queue') setUnreadCount((c) => c + 1);
            break;
          case 'queue_remove':
            setQueue((prev) => prev.filter((q) => q.conversationId !== msg.conversationId));
            break;
          case 'conversation_accepted':
            setActiveConv(msg.conversation.id);
            setActiveConvData(msg.conversation);
            setMessages(msg.messages);
            break;
          case 'visitor_message':
            if (msg.conversationId === activeConv) {
              setMessages((prev) => [...prev, {
                sender: 'visitor',
                content: msg.content,
                timestamp: msg.timestamp,
              }]);
            }
            break;
          case 'canned_responses':
            window.dispatchEvent(new CustomEvent('canned_responses', { detail: msg.responses }));
            break;
          case 'status_updated':
            setStatus(msg.status);
            break;
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimer = window.setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [token]);

  // Update activeConv ref for WS messages
  useEffect(() => {
    const ref = wsRef.current;
    if (!ref) return;
    const origHandler = ref.onmessage;
    ref.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'visitor_message' && msg.conversationId === activeConv) {
        setMessages((prev) => [...prev, {
          sender: 'visitor',
          content: msg.content,
          timestamp: msg.timestamp,
        }]);
      } else if (origHandler) {
        origHandler.call(ref, event);
      }
    };
  }, [activeConv]);

  const handleAccept = (conversationId: string) => {
    sendWS('accept_conversation', { conversationId });
  };

  const handleSendMessage = (content: string) => {
    if (!activeConv) return;
    sendWS('send_message', { conversationId: activeConv, content });
    setMessages((prev) => [...prev, {
      sender: 'agent',
      content,
      timestamp: new Date().toISOString(),
    }]);
  };

  const handleRequestCanned = () => {
    sendWS('list_canned', { conversationId: activeConv });
  };

  const handleClose = () => {
    if (!activeConv) return;
    sendWS('close_conversation', { conversationId: activeConv });
    setActiveConv(null);
    setActiveConvData(null);
    setMessages([]);
  };

  const handleStatusChange = (newStatus: string) => {
    sendWS('set_status', { status: newStatus });
    setStatus(newStatus);
  };

  return (
    <div className="flex h-screen" style={{ background: 'var(--rd-bg)' }}>
      {/* ─── Sidebar ─── */}
      <aside
        className={`${sidebarCollapsed ? 'w-[68px]' : 'w-60'} flex flex-col shrink-0 transition-all duration-300`}
        style={{ background: 'var(--rd-surface)', borderRight: '1px solid var(--rd-border)' }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4" style={{ borderBottom: '1px solid var(--rd-border)' }}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #E30613, #B8050F)', boxShadow: '0 2px 8px rgba(227,6,19,0.25)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            {!sidebarCollapsed && (
              <div className="animate-fade-in">
                <span className="font-bold text-sm" style={{ color: 'var(--rd-text)' }}>Redegal</span>
                <span className="block text-[10px] font-medium" style={{ color: 'var(--rd-text-muted)' }}>Agent Panel</span>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2.5 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => { setTab(item.id); if (item.id === 'queue') setUnreadCount(0); }}
              className={`sidebar-link w-full ${tab === item.id ? 'active' : ''}`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d={item.iconPath} />
              </svg>
              {!sidebarCollapsed && (
                <span className="flex-1 text-left truncate">{item.label}</span>
              )}
              {item.id === 'queue' && unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center animate-count-in shrink-0">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Shortcuts hint */}
        {!sidebarCollapsed && (
          <div className="mx-3 mb-3">
            <button
              onClick={() => setShowCmdPalette(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] transition-colors"
              style={{ background: 'var(--rd-surface-hover)', color: 'var(--rd-text-muted)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="flex-1 text-left">Buscar...</span>
              <kbd className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)' }}>
                {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl+'}K
              </kbd>
            </button>
          </div>
        )}

        {/* Agent info */}
        <div className="p-3" style={{ borderTop: '1px solid var(--rd-border)' }}>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)', color: '#475569' }}>
                {(agent?.displayName || 'A')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--rd-text)' }}>
                  {agent?.displayName || 'Agente'}
                </p>
                <AgentStatus status={status} onChange={handleStatusChange} compact />
              </div>
            </div>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="btn-icon flex-1 h-8"
              title={sidebarCollapsed ? 'Expandir' : 'Colapsar'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {sidebarCollapsed ? <><polyline points="9 18 15 12 9 6" /></> : <><polyline points="15 18 9 12 15 6" /></>}
              </svg>
            </button>
            {!sidebarCollapsed && (
              <>
                <button onClick={() => setDarkMode(!darkMode)} className="btn-icon h-8" title={darkMode ? 'Modo claro' : 'Modo oscuro'}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {darkMode ? <><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></>
                    : <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />}
                  </svg>
                </button>
                <button onClick={onLogout} className="btn-icon h-8 hover:!text-red-500" title="Cerrar sesion">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ─── Main content ─── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-6 shrink-0"
          style={{ background: 'var(--rd-surface)', borderBottom: '1px solid var(--rd-border)' }}>
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--rd-text)' }}>
              {TAB_TITLES[tab]}
            </h1>
            <p className="text-[11px] font-medium" style={{ color: 'var(--rd-text-muted)' }}>
              {tab === 'queue' && queue.length > 0 ? `${queue.length} en cola` : TAB_SUBTITLES[tab]}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Connection indicator */}
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--rd-text-muted)' }}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse-dot' : 'bg-slate-400'}`} />
              <span className="hidden sm:inline">{connected ? 'Conectado' : 'Reconectando...'}</span>
            </div>
            {/* Agent status (queue tab) */}
            {tab === 'queue' && (
              <AgentStatus status={status} onChange={handleStatusChange} />
            )}
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {tab === 'queue' && (
            <div className="flex h-full">
              <QueueView items={queue} onAccept={handleAccept} activeConvId={activeConv} />
              {activeConv ? (
                <ConversationPanel
                  messages={messages}
                  conversation={activeConvData}
                  onSend={handleSendMessage}
                  onClose={handleClose}
                  onRequestCanned={handleRequestCanned}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center" style={{ color: 'var(--rd-text-muted)' }}>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--rd-surface-hover)' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--rd-text-secondary)' }}>
                    Selecciona una conversacion
                  </p>
                  <p className="text-xs mt-1 opacity-60">
                    o espera una nueva en la cola
                  </p>
                </div>
              )}
            </div>
          )}
          {tab === 'leads' && <LeadsList />}
          {tab === 'analytics' && <Analytics />}
          {tab === 'settings' && <Settings />}
        </div>
      </main>

      {/* ─── Command Palette ─── */}
      {showCmdPalette && (
        <CommandPalette
          onClose={() => setShowCmdPalette(false)}
          onSelectTab={(t) => { setTab(t); setShowCmdPalette(false); }}
          queue={queue}
          onAccept={(id) => { handleAccept(id); setShowCmdPalette(false); }}
        />
      )}
    </div>
  );
}

/* ─── Command Palette (Cmd+K) ─── */
function CommandPalette({ onClose, onSelectTab, queue, onAccept }: {
  onClose: () => void;
  onSelectTab: (tab: Tab) => void;
  queue: QueueItem[];
  onAccept: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const commands = [
    { id: 'queue', label: 'Ir a Conversaciones', section: 'Navegacion', action: () => onSelectTab('queue') },
    { id: 'leads', label: 'Ir a Leads', section: 'Navegacion', action: () => onSelectTab('leads') },
    { id: 'analytics', label: 'Ir a Analytics', section: 'Navegacion', action: () => onSelectTab('analytics') },
    { id: 'settings', label: 'Ir a Ajustes', section: 'Navegacion', action: () => onSelectTab('settings') },
    ...queue.map((q) => ({
      id: `conv-${q.conversationId}`,
      label: `Aceptar: ${q.visitorId.slice(0, 8)} (${q.businessLine || 'general'})`,
      section: 'Cola',
      action: () => onAccept(q.conversationId),
    })),
  ];

  const filtered = search
    ? commands.filter((c) => c.label.toLowerCase().includes(search.toLowerCase()))
    : commands;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden animate-scale-in"
        style={{ background: 'var(--rd-surface)', borderColor: 'var(--rd-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--rd-border)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--rd-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar comando..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--rd-text)' }}
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono"
            style={{ background: 'var(--rd-surface-hover)', border: '1px solid var(--rd-border)', color: 'var(--rd-text-muted)' }}>
            ESC
          </kbd>
        </div>
        <div className="max-h-72 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--rd-text-muted)' }}>Sin resultados</p>
          ) : (
            filtered.map((cmd) => (
              <button
                key={cmd.id}
                onClick={cmd.action}
                className="w-full px-4 py-2.5 flex items-center gap-3 text-left text-sm transition-colors"
                style={{ color: 'var(--rd-text)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--rd-surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                  style={{ background: 'var(--rd-surface-hover)', color: 'var(--rd-text-muted)' }}>
                  {cmd.section}
                </span>
                <span className="flex-1">{cmd.label}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
