import React, { useState, useRef, useEffect } from 'react';

interface Props {
  status: string;
  onChange: (status: string) => void;
  compact?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'online', label: 'Disponible', color: 'bg-green-500' },
  { value: 'busy', label: 'Ocupado', color: 'bg-yellow-500' },
  { value: 'away', label: 'Ausente', color: 'bg-slate-400' },
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
          className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-700"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${current.color}`} />
          {current.label}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        {open && (
          <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 min-w-[120px] animate-fadeIn">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50"
              >
                <span className={`w-2 h-2 rounded-full ${opt.color}`} />
                {opt.label}
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
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-100 text-sm transition-colors"
      >
        <span className={`w-2.5 h-2.5 rounded-full ${current.color}`} />
        {current.label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 min-w-[140px] animate-fadeIn">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-slate-50"
            >
              <span className={`w-2 h-2 rounded-full ${opt.color}`} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
