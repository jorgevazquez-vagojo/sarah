import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createAgentWS } from '../api/client';
import { QueueView } from './QueueView';
import { ConversationPanel } from './ConversationPanel';
import { AgentStatus } from './AgentStatus';
import { LeadsList } from './LeadsList';
import { Analytics } from './Analytics';
import { Settings } from './Settings';
import { Training } from './Training';

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

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  admin: { label: 'Admin', color: '#DC2626', bg: '#FEE2E2' },
  supervisor: { label: 'Supervisor', color: '#7C3AED', bg: '#EDE9FE' },
  architect: { label: 'Arquitecto', color: '#2563EB', bg: '#DBEAFE' },
  developer: { label: 'Developer', color: '#059669', bg: '#D1FAE5' },
  qa: { label: 'QA', color: '#D97706', bg: '#FEF3C7' },
  agent: { label: 'Agente', color: '#64748B', bg: '#F1F5F9' },
};

type Tab = 'queue' | 'leads' | 'analytics' | 'training' | 'settings';

const NAV_ITEMS: { id: Tab; label: string; iconPath: string }[] = [
  { id: 'queue', label: 'Conversaciones', iconPath: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { id: 'leads', label: 'Leads', iconPath: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75' },
  { id: 'analytics', label: 'Analytics', iconPath: 'M18 20V10 M12 20V4 M6 20v-6' },
  { id: 'training', label: 'Entrenamiento', iconPath: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  { id: 'settings', label: 'Ajustes', iconPath: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' },
];

const TAB_TITLES: Record<Tab, string> = {
  queue: 'Conversaciones',
  leads: 'Leads',
  analytics: 'Analytics',
  training: 'Entrenamiento IA',
  settings: 'Ajustes',
};

const TAB_SUBTITLES: Record<Tab, string> = {
  queue: 'Gestiona chats en tiempo real',
  leads: 'Pipeline de contactos comerciales',
  analytics: 'Metricas y rendimiento',
  training: 'Revisa respuestas y entrena al chatbot',
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
  const [convSummary, setConvSummary] = useState<string | null>(null);
  const [visitorContext, setVisitorContext] = useState<any>(null);
  const [internalNotes, setInternalNotes] = useState<Array<{ content: string; agentName: string; timestamp: string }>>([]);
  const [incomingCall, setIncomingCall] = useState<{ callId: string; visitorId: string; language: string; businessLine: string } | null>(null);
  const [activeCall, setActiveCall] = useState<{ callId: string; state: string; duration: number } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const callPcRef = useRef<RTCPeerConnection | null>(null);
  const callStreamRef = useRef<MediaStream | null>(null);
  const callWsRef = useRef<WebSocket | null>(null);
  const callTimerRef = useRef<number | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

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
            setConvSummary(msg.summary || null);
            setVisitorContext(msg.visitorContext || null);
            setInternalNotes([]);
            break;
          case 'internal_note':
            setInternalNotes((prev) => [...prev, {
              content: msg.content,
              agentName: msg.agentName,
              timestamp: msg.timestamp,
            }]);
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
          case 'incoming_call':
            setIncomingCall({
              callId: msg.callId,
              visitorId: msg.visitorId,
              language: msg.language || 'es',
              businessLine: msg.businessLine || 'general',
            });
            break;
          case 'call_config':
            // After accepting, server sends config to connect signaling
            connectCallSignaling(msg.callId, token);
            break;
          case 'call_taken':
            // Another agent took the call
            if (incomingCall?.callId === msg.callId) setIncomingCall(null);
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
    setConvSummary(null);
    setVisitorContext(null);
    setInternalNotes([]);
  };

  const handleSendNote = (content: string) => {
    if (!activeConv) return;
    sendWS('internal_note', { conversationId: activeConv, content });
  };

  const handleMarkRead = () => {
    if (!activeConv) return;
    sendWS('mark_read', { conversationId: activeConv });
  };

  const handleStatusChange = (newStatus: string) => {
    sendWS('set_status', { status: newStatus });
    setStatus(newStatus);
  };

  // ─── WebRTC Call Functions ───
  const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const handleAcceptCall = () => {
    if (!incomingCall) return;
    sendWS('accept_call', { callId: incomingCall.callId });
    setActiveCall({ callId: incomingCall.callId, state: 'connecting', duration: 0 });
    setIncomingCall(null);
  };

  const handleRejectCall = () => {
    if (!incomingCall) return;
    sendWS('reject_call', { callId: incomingCall.callId });
    setIncomingCall(null);
  };

  const handleHangupCall = () => {
    if (activeCall) sendWS('hangup_call', { callId: activeCall.callId });
    cleanupCall();
  };

  const handleToggleMute = () => {
    if (callStreamRef.current) {
      const next = !isMuted;
      for (const track of callStreamRef.current.getAudioTracks()) track.enabled = !next;
      setIsMuted(next);
    }
  };

  function cleanupCall() {
    if (callPcRef.current) { callPcRef.current.close(); callPcRef.current = null; }
    if (callStreamRef.current) { for (const t of callStreamRef.current.getTracks()) t.stop(); callStreamRef.current = null; }
    if (callWsRef.current) { callWsRef.current.close(); callWsRef.current = null; }
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = null; remoteAudioRef.current.remove(); remoteAudioRef.current = null; }
    setActiveCall(null);
    setIsMuted(false);
  }

  async function connectCallSignaling(callId: string, agentToken: string) {
    try {
      callStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      setActiveCall(null);
      return;
    }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws/sip?role=agent&callId=${encodeURIComponent(callId)}&token=${encodeURIComponent(agentToken)}`;
    const ws = new WebSocket(url);
    callWsRef.current = ws;

    const sendSig = (type: string, data: Record<string, any> = {}) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, ...data }));
    };

    ws.onopen = () => sendSig('register', { callId });

    ws.onmessage = async (e) => {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case 'webrtc_offer': {
          // Visitor sent offer, create answer
          const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
          callPcRef.current = pc;

          pc.onicecandidate = (ev) => {
            if (ev.candidate) sendSig('ice_candidate', { candidate: ev.candidate.toJSON() });
          };

          pc.oniceconnectionstatechange = () => {
            const s = pc.iceConnectionState;
            if (s === 'connected' || s === 'completed') {
              setActiveCall((prev) => prev ? { ...prev, state: 'active' } : null);
              // Start duration timer
              callTimerRef.current = window.setInterval(() => {
                setActiveCall((prev) => prev ? { ...prev, duration: prev.duration + 1 } : null);
              }, 1000);
            } else if (s === 'disconnected' || s === 'failed') {
              cleanupCall();
            }
          };

          pc.ontrack = (ev) => {
            if (!remoteAudioRef.current) {
              remoteAudioRef.current = document.createElement('audio');
              remoteAudioRef.current.autoplay = true;
              remoteAudioRef.current.style.display = 'none';
              document.body.appendChild(remoteAudioRef.current);
            }
            remoteAudioRef.current.srcObject = ev.streams[0] || new MediaStream([ev.track]);
          };

          if (callStreamRef.current) {
            for (const track of callStreamRef.current.getAudioTracks()) pc.addTrack(track, callStreamRef.current);
          }

          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp }));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSig('webrtc_answer', { sdp: answer.sdp });
          break;
        }

        case 'ice_candidate': {
          if (callPcRef.current && msg.candidate) {
            await callPcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
          }
          break;
        }

        case 'call_ended': {
          cleanupCall();
          break;
        }
      }
    };

    ws.onclose = () => {
      if (activeCall) cleanupCall();
    };
  }

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
              style={{ background: 'linear-gradient(135deg, #007fff, #0066cc)', boxShadow: '0 2px 8px rgba(0,127,255,0.25)' }}>
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
                {agent?.role && agent.role !== 'agent' && (() => {
                  const rm = ROLE_META[agent.role] || ROLE_META.agent;
                  return (
                    <span className="inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-md mb-0.5"
                      style={{ background: rm.bg, color: rm.color }}>
                      {rm.label}
                    </span>
                  );
                })()}
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
                  summary={convSummary}
                  visitorContext={visitorContext}
                  internalNotes={internalNotes}
                  onSendNote={handleSendNote}
                  onMarkRead={handleMarkRead}
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
          {tab === 'training' && <Training />}
          {tab === 'settings' && <Settings />}
        </div>
      </main>

      {/* ─── Incoming Call Notification ─── */}
      {incomingCall && (
        <div className="fixed top-6 right-6 z-50 animate-scale-in" style={{ width: 340 }}>
          <div className="rounded-2xl shadow-2xl border overflow-hidden"
            style={{ background: 'var(--rd-surface)', borderColor: 'var(--rd-border)' }}>
            <div className="px-5 py-4 flex items-center gap-4" style={{ background: 'linear-gradient(135deg, #007fff, #0066cc)' }}>
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center animate-ring">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
                </svg>
              </div>
              <div className="flex-1 text-white">
                <p className="font-semibold text-sm">Llamada entrante</p>
                <p className="text-xs opacity-80">
                  Visitante {incomingCall.visitorId.slice(0, 8)} &middot; {incomingCall.businessLine} &middot; {incomingCall.language.toUpperCase()}
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-4">
              <button onClick={handleRejectCall}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: 'var(--rd-surface-hover)', color: 'var(--rd-text-secondary)' }}>
                Rechazar
              </button>
              <button onClick={handleAcceptCall}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ background: '#10b981' }}>
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Active Call Bar ─── */}
      {activeCall && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-4 px-6 py-3 rounded-2xl shadow-2xl border"
            style={{ background: 'var(--rd-surface)', borderColor: 'var(--rd-border)' }}>
            <div className={`w-3 h-3 rounded-full ${activeCall.state === 'active' ? 'bg-emerald-500 animate-pulse-dot' : 'bg-amber-500 animate-pulse'}`} />
            <span className="text-sm font-semibold" style={{ color: 'var(--rd-text)' }}>
              {activeCall.state === 'active' ? 'En llamada' : 'Conectando...'}
            </span>
            {activeCall.state === 'active' && (
              <span className="font-mono text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--rd-surface-hover)', color: 'var(--rd-text-secondary)' }}>
                {Math.floor(activeCall.duration / 60).toString().padStart(2, '0')}:{(activeCall.duration % 60).toString().padStart(2, '0')}
              </span>
            )}
            <button onClick={handleToggleMute}
              className="btn-icon h-9 w-9"
              style={{ color: isMuted ? 'var(--rd-danger)' : 'var(--rd-text-secondary)', background: isMuted ? 'rgba(239,68,68,0.1)' : undefined }}
              title={isMuted ? 'Activar micro' : 'Silenciar'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {isMuted ? (
                  <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .76-.12 1.5-.35 2.18"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
                ) : (
                  <><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
                )}
              </svg>
            </button>
            <button onClick={handleHangupCall}
              className="h-9 px-4 rounded-xl text-sm font-semibold text-white transition-colors"
              style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}>
              Colgar
            </button>
          </div>
        </div>
      )}

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
