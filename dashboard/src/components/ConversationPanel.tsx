import React, { useState, useRef, useEffect, useMemo } from 'react';

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

interface InternalNote {
  content: string;
  agentName: string;
  timestamp: string;
}

interface Props {
  messages: Message[];
  conversation?: any;
  onSend: (content: string) => void;
  onClose: () => void;
  onRequestCanned: () => void;
  summary?: string | null;
  visitorContext?: { pageUrl?: string; pageTitle?: string; referrer?: string } | null;
  internalNotes?: InternalNote[];
  onSendNote?: (content: string) => void;
  onMarkRead?: () => void;
}

const LINE_LABELS: Record<string, string> = {
  boostic: 'Boostic',
  binnacle: 'Binnacle',
  marketing: 'Marketing',
  tech: 'Tech',
};

const LINE_BADGES: Record<string, string> = {
  boostic: 'badge-blue',
  binnacle: 'badge-purple',
  marketing: 'badge-green',
  tech: 'badge-orange',
};

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

interface GroupedMsg {
  sender: string;
  messages: Message[];
}

function groupMessages(msgs: Message[]): GroupedMsg[] {
  const groups: GroupedMsg[] = [];
  for (const msg of msgs) {
    // Skip internal notes in main message flow
    if (msg.metadata?.internal) continue;
    const last = groups[groups.length - 1];
    if (last && last.sender === msg.sender) {
      const prevTs = new Date(last.messages[last.messages.length - 1].timestamp).getTime();
      const curTs = new Date(msg.timestamp).getTime();
      if (curTs - prevTs < 60000) {
        last.messages.push(msg);
        continue;
      }
    }
    groups.push({ sender: msg.sender, messages: [msg] });
  }
  return groups;
}

export function ConversationPanel({ messages, conversation, onSend, onClose, onRequestCanned, summary, visitorContext, internalNotes, onSendNote, onMarkRead }: Props) {
  const [input, setInput] = useState('');
  const [showCanned, setShowCanned] = useState(false);
  const [cannedList, setCannedList] = useState<CannedResponse[]>([]);
  const [cannedFilter, setCannedFilter] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const grouped = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read when conversation is opened
  useEffect(() => {
    if (onMarkRead) onMarkRead();
  }, [conversation?.id]);

  useEffect(() => {
    const handler = (e: Event) => {
      const responses = (e as CustomEvent).detail;
      setCannedList(responses);
    };
    window.addEventListener('canned_responses', handler);
    return () => window.removeEventListener('canned_responses', handler);
  }, []);

  // Inline canned filter on /
  useEffect(() => {
    if (input.startsWith('/') && input.length > 1 && !showCanned) {
      onRequestCanned();
      setShowCanned(true);
      setCannedFilter(input.slice(1));
    } else if (!input.startsWith('/') && showCanned) {
      setShowCanned(false);
      setCannedFilter('');
    } else if (input.startsWith('/')) {
      setCannedFilter(input.slice(1));
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput('');
    setShowCanned(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
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
    inputRef.current?.focus();
  };

  const handleSendNote = () => {
    if (!noteInput.trim() || !onSendNote) return;
    onSendNote(noteInput.trim());
    setNoteInput('');
  };

  const filteredCanned = cannedFilter
    ? cannedList.filter((c) =>
        c.title.toLowerCase().includes(cannedFilter.toLowerCase()) ||
        c.shortcut.toLowerCase().includes(cannedFilter.toLowerCase()) ||
        c.content.toLowerCase().includes(cannedFilter.toLowerCase())
      )
    : cannedList;

  const lang = conversation?.language?.toUpperCase();
  const line = conversation?.business_line;

  return (
    <div className="flex-1 flex relative">
      {/* Main conversation area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ background: 'var(--rd-surface)', borderBottom: '1px solid var(--rd-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--rd-surface-hover)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--rd-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <span className="text-sm font-semibold" style={{ color: 'var(--rd-text)' }}>
                {conversation?.visitor_id?.slice(0, 12) || 'Visitante'}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {lang && <span className="badge badge-gray">{lang}</span>}
                {line && <span className={`badge ${LINE_BADGES[line] || 'badge-gray'}`}>{LINE_LABELS[line] || line}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowSidebar(!showSidebar)}
              className={`btn-ghost text-xs flex items-center gap-1.5 ${showSidebar ? '!bg-blue-50 !text-blue-600' : ''}`}
              title="Info y notas">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              Info
            </button>
            <button onClick={handleCannedClick} className="btn-ghost text-xs flex items-center gap-1.5" title="Respuestas rapidas">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Rapidas
            </button>
            <button onClick={onClose} className="btn-ghost text-xs hover:!text-red-500 hover:!bg-red-50">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 inline">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Cerrar
            </button>
          </div>
        </div>

        {/* AI Summary banner */}
        {summary && (
          <div className="px-5 py-3 flex items-start gap-3 animate-fade-in"
            style={{ background: 'var(--rd-surface)', borderBottom: '1px solid var(--rd-border)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#8B5CF6' }}>
                Resumen IA
              </span>
              <p className="text-xs mt-0.5 leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--rd-text-secondary)' }}>
                {summary}
              </p>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1" style={{ background: 'var(--rd-bg)' }}>
          {grouped.map((group, gi) => {
            const isAgent = group.sender === 'agent';
            const isSystem = group.sender === 'system';
            const isNote = group.sender === 'note';

            if (isSystem) {
              return group.messages.map((msg, mi) => (
                <div key={`${gi}-${mi}`} className="flex justify-center py-1 animate-fade-in">
                  <span className="msg-system">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    {msg.content}
                  </span>
                </div>
              ));
            }

            if (isNote) {
              return group.messages.map((msg, mi) => (
                <div key={`${gi}-${mi}`} className="flex justify-center py-1 animate-fade-in">
                  <span className="text-[11px] px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 font-medium"
                    style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                    {msg.metadata?.agentName && <strong>{msg.metadata.agentName}:</strong>}
                    {msg.content}
                  </span>
                </div>
              ));
            }

            return (
              <div key={gi} className={`flex ${isAgent ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className={`flex gap-2 ${isAgent ? 'flex-row-reverse' : 'flex-row'} max-w-[70%]`}>
                  {!isAgent && (
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-1 text-[10px] font-bold"
                      style={{ background: 'var(--rd-surface-hover)', color: 'var(--rd-text-muted)' }}>
                      {group.sender === 'bot' ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v4 M12 18v4 M4.93 4.93l2.83 2.83 M16.24 16.24l2.83 2.83 M2 12h4 M18 12h4 M4.93 19.07l2.83-2.83 M16.24 7.76l2.83-2.83" /></svg>
                      ) : 'V'}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    <span className={`text-[10px] font-medium block mb-1 ${isAgent ? 'text-right' : ''}`}
                      style={{ color: 'var(--rd-text-muted)' }}>
                      {isAgent ? 'Tu' : group.sender === 'bot' ? 'Bot IA' : 'Visitante'}
                    </span>
                    {group.messages.map((msg, mi) => (
                      <div key={mi} className={`px-3.5 py-2.5 text-sm ${
                        isAgent ? 'msg-agent' : group.sender === 'bot' ? 'msg-bot' : 'msg-visitor'
                      }`}>
                        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                        <span className={`text-[9px] block mt-1 ${isAgent ? 'text-white/50' : ''}`}
                          style={!isAgent ? { color: 'var(--rd-text-muted)' } : undefined}>
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* Canned responses panel */}
        {showCanned && (
          <div className="absolute bottom-20 left-4 right-4 rounded-2xl shadow-xl max-h-64 flex flex-col z-10 animate-scale-in overflow-hidden"
            style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)' }}>
            <div className="px-3.5 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--rd-border)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--rd-text-muted)" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={cannedFilter}
                onChange={(e) => setCannedFilter(e.target.value)}
                placeholder="Buscar respuesta..."
                className="flex-1 text-xs outline-none bg-transparent"
                style={{ color: 'var(--rd-text)' }}
                autoFocus
              />
              <button onClick={() => { setShowCanned(false); setCannedFilter(''); }} className="btn-icon w-6 h-6">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {filteredCanned.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: 'var(--rd-text-muted)' }}>
                  {cannedList.length === 0 ? 'Cargando...' : 'Sin resultados'}
                </p>
              ) : (
                filteredCanned.map((resp, i) => (
                  <button
                    key={i}
                    onClick={() => handleCannedSelect(resp)}
                    className="w-full text-left px-3.5 py-2.5 transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--rd-surface-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--rd-surface-hover)', color: 'var(--rd-text-muted)' }}>
                        /{resp.shortcut}
                      </span>
                      <span className="text-xs font-medium" style={{ color: 'var(--rd-text)' }}>{resp.title}</span>
                      {resp.category && <span className="text-[9px]" style={{ color: 'var(--rd-text-muted)' }}>{resp.category}</span>}
                    </div>
                    <p className="text-[11px] truncate" style={{ color: 'var(--rd-text-muted)' }}>{resp.content}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-3 shrink-0" style={{ background: 'var(--rd-surface)', borderTop: '1px solid var(--rd-border)' }}>
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu respuesta... (/ para atajos)"
              className="input-field resize-none min-h-[42px] max-h-32"
              rows={1}
              autoFocus
              style={{ lineHeight: '1.5' }}
            />
            <button
              onClick={() => handleSubmit()}
              disabled={!input.trim()}
              className="btn-primary shrink-0 w-10 h-10 flex items-center justify-center !p-0 !rounded-xl"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-3 mt-1.5 px-1">
            <span className="text-[10px]" style={{ color: 'var(--rd-text-muted)' }}>
              Enter para enviar &middot; Shift+Enter nueva linea
            </span>
          </div>
        </div>
      </div>

      {/* ─── Info Sidebar ─── */}
      {showSidebar && (
        <div className="w-72 shrink-0 flex flex-col overflow-y-auto animate-slide-in"
          style={{ background: 'var(--rd-surface)', borderLeft: '1px solid var(--rd-border)' }}>
          {/* Visitor context */}
          {visitorContext && (
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--rd-border)' }}>
              <h4 className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--rd-text-muted)' }}>
                Contexto del visitante
              </h4>
              {visitorContext.pageTitle && (
                <p className="text-xs mb-1 truncate" style={{ color: 'var(--rd-text)' }}>
                  <strong>Pagina:</strong> {visitorContext.pageTitle}
                </p>
              )}
              {visitorContext.pageUrl && (
                <p className="text-[11px] truncate mb-1" style={{ color: 'var(--rd-primary)' }}>
                  {visitorContext.pageUrl}
                </p>
              )}
              {visitorContext.referrer && (
                <p className="text-[11px] truncate" style={{ color: 'var(--rd-text-muted)' }}>
                  Ref: {visitorContext.referrer}
                </p>
              )}
            </div>
          )}

          {/* AI Summary */}
          {summary && (
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--rd-border)' }}>
              <h4 className="text-[10px] font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: '#8B5CF6' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Resumen IA
              </h4>
              <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--rd-text-secondary)' }}>
                {summary}
              </p>
            </div>
          )}

          {/* Internal Notes */}
          <div className="px-4 py-3 flex-1">
            <h4 className="text-[10px] font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: '#D97706' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>
              Notas internas
            </h4>

            {/* Existing notes */}
            <div className="space-y-2 mb-3">
              {(!internalNotes || internalNotes.length === 0) && (
                <p className="text-[11px] italic" style={{ color: 'var(--rd-text-muted)' }}>Sin notas</p>
              )}
              {internalNotes?.map((note, i) => (
                <div key={i} className="rounded-lg p-2.5 text-xs"
                  style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
                  <div className="flex items-center justify-between mb-1">
                    <strong className="text-[10px]" style={{ color: '#92400E' }}>{note.agentName}</strong>
                    <span className="text-[9px]" style={{ color: '#B45309' }}>{formatTime(note.timestamp)}</span>
                  </div>
                  <p style={{ color: '#78350F' }}>{note.content}</p>
                </div>
              ))}
            </div>

            {/* New note input */}
            {onSendNote && (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendNote(); }}
                  placeholder="Agregar nota..."
                  className="input-field text-xs flex-1"
                />
                <button
                  onClick={handleSendNote}
                  disabled={!noteInput.trim()}
                  className="btn-ghost text-xs shrink-0 !px-2.5"
                  style={{ color: '#D97706' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
