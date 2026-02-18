import React, { useState, useEffect } from 'react';

export interface QueueItem {
  conversationId: string;
  visitorId: string;
  language: string;
  businessLine: string;
  lastMessage?: string;
  createdAt?: string;
}

interface Props {
  items: QueueItem[];
  onAccept: (conversationId: string) => void;
  activeConvId: string | null;
}

const LINE_META: Record<string, { gradient: string; bg: string; label: string; icon: string }> = {
  boostic: {
    gradient: 'linear-gradient(135deg, #3B82F6, #6366F1)',
    bg: 'rgba(59,130,246,0.08)',
    label: 'Boostic',
    icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  },
  binnacle: {
    gradient: 'linear-gradient(135deg, #8B5CF6, #A855F7)',
    bg: 'rgba(139,92,246,0.08)',
    label: 'Binnacle',
    icon: 'M18 20V10 M12 20V4 M6 20v-6',
  },
  marketing: {
    gradient: 'linear-gradient(135deg, #10B981, #059669)',
    bg: 'rgba(16,185,129,0.08)',
    label: 'Marketing',
    icon: 'M22 12h-4l-3 9L9 3l-3 9H2',
  },
  tech: {
    gradient: 'linear-gradient(135deg, #F59E0B, #EF4444)',
    bg: 'rgba(245,158,11,0.08)',
    label: 'Tech',
    icon: 'M16 18l6-6-6-6 M8 6l-6 6 6 6',
  },
};

const LANG_FLAGS: Record<string, string> = {
  es: 'ES', en: 'EN', pt: 'PT', fr: 'FR', de: 'DE', it: 'IT',
  nl: 'NL', zh: 'ZH', ja: 'JA', ko: 'KO', ar: 'AR', gl: 'GL',
};

function WaitTimer({ createdAt }: { createdAt?: string }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!createdAt) return;
    const update = () => {
      const diff = Date.now() - new Date(createdAt).getTime();
      const secs = Math.floor(diff / 1000);
      if (secs < 60) setElapsed(`${secs}s`);
      else if (secs < 3600) setElapsed(`${Math.floor(secs / 60)}m`);
      else setElapsed(`${Math.floor(secs / 3600)}h`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  if (!elapsed) return null;

  const diff = createdAt ? Date.now() - new Date(createdAt).getTime() : 0;
  const isUrgent = diff > 120000; // 2 min
  const isWarning = diff > 60000; // 1 min

  return (
    <span className={`text-[10px] font-semibold tabular-nums ${
      isUrgent ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-slate-400'
    }`}>
      {elapsed}
    </span>
  );
}

export function QueueView({ items, onAccept, activeConvId }: Props) {
  return (
    <div className="w-80 flex flex-col shrink-0"
      style={{ background: 'var(--rd-surface)', borderRight: '1px solid var(--rd-border)' }}>

      {/* Header */}
      <div className="px-4 py-3.5 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--rd-border)' }}>
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-bold" style={{ color: 'var(--rd-text)' }}>Cola</h2>
          {items.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white animate-count-in">
              {items.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] font-medium" style={{ color: 'var(--rd-text-muted)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          En vivo
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto py-1">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: 'var(--rd-surface-hover)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30" style={{ color: 'var(--rd-text-muted)' }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <p className="text-xs font-medium" style={{ color: 'var(--rd-text-secondary)' }}>
              Sin conversaciones en espera
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--rd-text-muted)' }}>
              Apareceran aqui automaticamente
            </p>
          </div>
        ) : (
          items.map((item, i) => {
            const line = LINE_META[item.businessLine];
            const langCode = LANG_FLAGS[item.language] || item.language?.toUpperCase() || '??';
            const isActive = activeConvId === item.conversationId;
            const waitMs = item.createdAt ? Date.now() - new Date(item.createdAt).getTime() : 0;
            const priority = waitMs > 120000 ? 'high' : waitMs > 60000 ? 'medium' : '';

            return (
              <div
                key={item.conversationId}
                className={`conv-card ${isActive ? 'active' : ''} ${priority ? `priority-${priority}` : ''} animate-slide-in`}
                style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => onAccept(item.conversationId)}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  {/* Avatar */}
                  <div className="conv-avatar w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ background: line?.bg || 'var(--rd-surface-hover)', color: 'var(--rd-text-secondary)' }}>
                    {item.visitorId.slice(0, 2).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold truncate" style={{ color: 'var(--rd-text)' }}>
                        {item.visitorId.slice(0, 8)}
                      </span>
                      <WaitTimer createdAt={item.createdAt} />
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-bold px-1.5 py-px rounded"
                        style={{ background: 'var(--rd-surface-hover)', color: 'var(--rd-text-muted)' }}>
                        {langCode}
                      </span>
                      {line && (
                        <span className="text-[10px] font-semibold px-1.5 py-px rounded" style={{ background: line.bg, color: 'inherit' }}>
                          <span style={{ backgroundImage: line.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            {line.label}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Last message preview */}
                {item.lastMessage && (
                  <p className="text-[11px] truncate ml-10" style={{ color: 'var(--rd-text-muted)' }}>
                    {item.lastMessage}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
