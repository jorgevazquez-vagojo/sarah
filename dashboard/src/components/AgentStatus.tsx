import React, { useState, useRef, useEffect } from 'react';

interface Props {
  status: string;
  onChange: (status: string) => void;
  compact?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'online', label: 'Disponible', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  { value: 'busy', label: 'Ocupado', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { value: 'away', label: 'Ausente', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
];

export function AgentStatus({ status, onChange, compact }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (compact) {
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 text-[11px] transition-colors"
          style={{ color: 'var(--rd-text-muted)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: current.color }} />
          <span>{current.label}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {open && (
          <div className="absolute left-0 top-full mt-1.5 rounded-xl shadow-lg py-1.5 z-50 min-w-[130px] animate-scale-in"
            style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)', boxShadow: 'var(--rd-shadow-lg)' }}>
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-left transition-colors"
                style={{ color: 'var(--rd-text)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--rd-surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: opt.color }} />
                <span className="font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
        style={{ background: current.bg, color: 'var(--rd-text)' }}
      >
        <span className="w-2.5 h-2.5 rounded-full animate-pulse-dot" style={{ backgroundColor: current.color }} />
        <span>{current.label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--rd-text-muted)' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 rounded-xl shadow-xl py-1.5 z-50 min-w-[150px] animate-scale-in"
          style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)', boxShadow: 'var(--rd-shadow-lg)' }}>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm text-left transition-colors"
              style={{ color: 'var(--rd-text)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--rd-surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: opt.color }} />
              <span className="font-medium">{opt.label}</span>
              {status === opt.value && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-auto" style={{ color: 'var(--rd-primary)' }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
