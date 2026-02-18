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
}

export interface Message {
  sender: string;
  content: string;
  timestamp: string;
  metadata?: any;
}

type Tab = 'queue' | 'leads' | 'analytics' | 'settings';

const NAV_ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: 'queue', label: 'Conversaciones', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { id: 'leads', label: 'Leads', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75' },
  { id: 'analytics', label: 'Analytics', icon: 'M18 20V10 M12 20V4 M6 20v-6' },
  { id: 'settings', label: 'Ajustes', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' },
];

export function Dashboard({ token, agent, onLogout }: Props) {
  const [tab, setTab] = useState<Tab>('queue');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [activeConvData, setActiveConvData] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState(agent?.status || 'online');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

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
            // Handled in ConversationPanel via event
            window.dispatchEvent(new CustomEvent('canned_responses', { detail: msg.responses }));
            break;
          case 'status_updated':
            setStatus(msg.status);
            break;
        }
      };

      ws.onclose = () => {
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
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-56'} bg-white border-r border-slate-200/60 flex flex-col transition-all duration-300 shrink-0`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-700 rounded-lg flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            {!sidebarCollapsed && <span className="font-bold text-slate-800 text-sm">Redegal</span>}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => { setTab(item.id); if (item.id === 'queue') setUnreadCount(0); }}
              className={`sidebar-link w-full ${tab === item.id ? 'active' : ''}`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d={item.icon} />
              </svg>
              {!sidebarCollapsed && (
                <span className="flex-1 text-left">{item.label}</span>
              )}
              {item.id === 'queue' && unreadCount > 0 && !sidebarCollapsed && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Agent info */}
        <div className="p-3 border-t border-slate-100">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
                {(agent?.displayName || 'A')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{agent?.displayName || 'Agente'}</p>
                <AgentStatus status={status} onChange={handleStatusChange} compact />
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="btn-ghost w-full text-center text-[10px]"
          >
            {sidebarCollapsed ? '>>' : '<<'}
          </button>
          {!sidebarCollapsed && (
            <button onClick={onLogout} className="btn-ghost w-full mt-1 text-xs text-slate-400 hover:text-red-500">
              Cerrar sesion
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-200/60 flex items-center justify-between px-6 shrink-0">
          <div>
            <h1 className="text-lg font-bold text-slate-800">
              {tab === 'queue' ? `Conversaciones` : tab === 'leads' ? 'Leads' : tab === 'analytics' ? 'Analytics' : 'Ajustes'}
            </h1>
            <p className="text-xs text-slate-400">
              {tab === 'queue' ? `${queue.length} en cola` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {tab === 'queue' && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className={`w-2 h-2 rounded-full ${status === 'online' ? 'bg-green-500 animate-pulse-dot' : status === 'busy' ? 'bg-yellow-500' : 'bg-slate-400'}`} />
                {status === 'online' ? 'Disponible' : status === 'busy' ? 'Ocupado' : 'Ausente'}
              </div>
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
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-30">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <p className="text-sm">Selecciona una conversacion</p>
                  <p className="text-xs mt-1 opacity-60">o espera una nueva en la cola</p>
                </div>
              )}
            </div>
          )}
          {tab === 'leads' && <LeadsList />}
          {tab === 'analytics' && <Analytics />}
          {tab === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  );
}
