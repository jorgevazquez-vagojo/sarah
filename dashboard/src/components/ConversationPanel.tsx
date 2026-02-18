import React, { useState, useRef, useEffect } from 'react';

interface Message {
  sender: string;
  content: string;
  timestamp: string;
  metadata?: any;
}

interface CannedResponse {
  shortcut: string;
  title: string;
  content: string;
  category?: string;
}

interface Props {
  messages: Message[];
  conversation?: any;
  onSend: (content: string) => void;
  onClose: () => void;
  onRequestCanned: () => void;
}

const SENDER_META: Record<string, { label: string; align: string; bubble: string }> = {
  agent: { label: 'Tu', align: 'justify-end', bubble: 'bg-red-600 text-white rounded-br-sm' },
  visitor: { label: 'Visitante', align: 'justify-start', bubble: 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm shadow-sm' },
  bot: { label: 'Bot IA', align: 'justify-start', bubble: 'bg-slate-100 text-slate-700 rounded-bl-sm' },
  system: { label: 'Sistema', align: 'justify-center', bubble: 'bg-slate-50 text-slate-500 italic text-xs' },
};

export function ConversationPanel({ messages, conversation, onSend, onClose, onRequestCanned }: Props) {
  const [input, setInput] = useState('');
  const [showCanned, setShowCanned] = useState(false);
  const [cannedList, setCannedList] = useState<CannedResponse[]>([]);
  const [cannedFilter, setCannedFilter] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for canned responses from WS
  useEffect(() => {
    const handler = (e: Event) => {
      const responses = (e as CustomEvent).detail;
      setCannedList(responses);
    };
    window.addEventListener('canned_responses', handler);
    return () => window.removeEventListener('canned_responses', handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput('');
  };

  const handleCannedClick = () => {
    if (!showCanned) {
      onRequestCanned();
      setShowCanned(true);
    } else {
      setShowCanned(false);
    }
  };

  const handleCannedSelect = (resp: CannedResponse) => {
    setInput(resp.content);
    setShowCanned(false);
    setCannedFilter('');
  };

  const filteredCanned = cannedFilter
    ? cannedList.filter((c) =>
        c.title.toLowerCase().includes(cannedFilter.toLowerCase()) ||
        c.shortcut.toLowerCase().includes(cannedFilter.toLowerCase()) ||
        c.content.toLowerCase().includes(cannedFilter.toLowerCase())
      )
    : cannedList;

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  return (
    <div className="flex-1 flex flex-col relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200/60 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-medium text-slate-700">Conversacion activa</span>
            {conversation && (
              <div className="flex items-center gap-2 mt-0.5">
                {conversation.language && <span className="text-[10px] badge badge-gray">{conversation.language.toUpperCase()}</span>}
                {conversation.business_line && <span className="text-[10px] badge badge-blue">{conversation.business_line}</span>}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCannedClick} className="btn-ghost text-xs flex items-center gap-1" title="Respuestas rapidas">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Rapidas
          </button>
          <button onClick={onClose} className="btn-ghost text-xs text-red-500 hover:bg-red-50 hover:text-red-600">
            Cerrar
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50/50">
        {messages.map((msg, i) => {
          const meta = SENDER_META[msg.sender] || SENDER_META.system;
          return (
            <div key={i} className={`flex ${meta.align} animate-fadeIn`}>
              <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${meta.bubble}`}>
                {msg.sender !== 'agent' && (
                  <span className={`text-[10px] font-medium block mb-0.5 ${msg.sender === 'visitor' ? 'text-slate-400' : 'opacity-60'}`}>
                    {meta.label}
                  </span>
                )}
                <div className="whitespace-pre-wrap">{msg.content}</div>
                <span className={`text-[9px] block mt-1 ${msg.sender === 'agent' ? 'text-white/50' : 'text-slate-400'}`}>
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Canned responses panel */}
      {showCanned && (
        <div className="absolute bottom-16 left-4 right-4 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-72 flex flex-col z-10 animate-fadeIn">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              value={cannedFilter}
              onChange={(e) => setCannedFilter(e.target.value)}
              placeholder="Buscar respuesta..."
              className="flex-1 text-xs outline-none bg-transparent text-slate-700 placeholder:text-slate-400"
              autoFocus
            />
            <button onClick={() => setShowCanned(false)} className="text-slate-400 hover:text-slate-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {filteredCanned.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                {cannedList.length === 0 ? 'Cargando...' : 'Sin resultados'}
              </p>
            ) : (
              filteredCanned.map((resp, i) => (
                <button
                  key={i}
                  onClick={() => handleCannedSelect(resp)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-500">/{resp.shortcut}</span>
                    <span className="text-xs font-medium text-slate-700">{resp.title}</span>
                    {resp.category && <span className="text-[9px] text-slate-400">{resp.category}</span>}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{resp.content}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-slate-200/60 bg-white">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu respuesta... (usa /shortcut para respuestas rapidas)"
          className="input-field"
          autoFocus
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="btn-primary shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </div>
  );
}
