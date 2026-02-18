import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createAgentWS } from '../api/client';
import { QueueView } from './QueueView';
import { ConversationPanel } from './ConversationPanel';
import { AgentStatus } from './AgentStatus';
import { LeadsList } from './LeadsList';
import { Analytics } from './Analytics';

interface Props {
  token: string;
  agent: any;
  onLogout: () => void;
}

interface QueueItem {
  conversationId: string;
  visitorId: string;
  language: string;
  businessLine: string;
  lastMessage?: string;
}

interface Message {
  sender: string;
  content: string;
  timestamp: string;
}

export function Dashboard({ token, agent, onLogout }: Props) {
  const [tab, setTab] = useState<'queue' | 'leads' | 'analytics'>('queue');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState(agent?.status || 'online');
  const wsRef = useRef<WebSocket | null>(null);

  const sendWS = useCallback((type: string, data: Record<string, any> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...data }));
    }
  }, []);

  useEffect(() => {
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
          })));
          break;
        case 'queue_new':
          setQueue((prev) => [...prev, {
            conversationId: msg.conversationId,
            visitorId: msg.visitorId,
            language: msg.language,
            businessLine: msg.businessLine,
          }]);
          break;
        case 'queue_remove':
          setQueue((prev) => prev.filter((q) => q.conversationId !== msg.conversationId));
          break;
        case 'conversation_accepted':
          setActiveConv(msg.conversation.id);
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
        case 'status_updated':
          setStatus(msg.status);
          break;
      }
    };

    ws.onclose = () => {
      // Reconnect after 3s
      setTimeout(() => {
        wsRef.current = createAgentWS(token);
      }, 3000);
    };

    return () => ws.close();
  }, [token, activeConv]);

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

  const handleClose = () => {
    if (!activeConv) return;
    sendWS('close_conversation', { conversationId: activeConv });
    setActiveConv(null);
    setMessages([]);
  };

  const handleStatusChange = (newStatus: string) => {
    sendWS('set_status', { status: newStatus });
    setStatus(newStatus);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-redegal">Redegal</h1>
          <nav className="flex gap-1">
            {(['queue', 'leads', 'analytics'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-sm rounded-lg ${
                  tab === t ? 'bg-red-50 text-redegal font-medium' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t === 'queue' ? `Cola (${queue.length})` : t === 'leads' ? 'Leads' : 'Analytics'}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <AgentStatus status={status} onChange={handleStatusChange} />
          <span className="text-sm text-gray-600">{agent?.displayName}</span>
          <button onClick={onLogout} className="text-sm text-gray-400 hover:text-gray-600">
            Salir
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex h-[calc(100vh-57px)]">
        {/* Main content */}
        <div className="flex-1 overflow-auto">
          {tab === 'queue' && (
            <div className="flex h-full">
              <QueueView items={queue} onAccept={handleAccept} activeConvId={activeConv} />
              {activeConv ? (
                <ConversationPanel
                  messages={messages}
                  onSend={handleSendMessage}
                  onClose={handleClose}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                  Selecciona una conversación de la cola
                </div>
              )}
            </div>
          )}
          {tab === 'leads' && <LeadsList />}
          {tab === 'analytics' && <Analytics />}
        </div>
      </div>
    </div>
  );
}
