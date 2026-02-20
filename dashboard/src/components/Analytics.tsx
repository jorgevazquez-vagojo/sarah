import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

interface Stats {
  totalConversations: number;
  totalLeads: number;
  avgResponseTime: number;
  csatAvg: number;
  byBusinessLine: Record<string, number>;
  byLanguage: Record<string, number>;
}

const LINE_META: Record<string, { color: string; gradient: string; label: string }> = {
  boostic: { color: '#3B82F6', gradient: 'linear-gradient(135deg, #3B82F6, #6366F1)', label: 'Boostic' },
  binnacle: { color: '#8B5CF6', gradient: 'linear-gradient(135deg, #8B5CF6, #A855F7)', label: 'Binnacle' },
  marketing: { color: '#10B981', gradient: 'linear-gradient(135deg, #10B981, #059669)', label: 'Marketing' },
  tech: { color: '#F59E0B', gradient: 'linear-gradient(135deg, #F59E0B, #EF4444)', label: 'Tech' },
};

const LANG_NAMES: Record<string, string> = {
  es: 'Espanol', en: 'English', pt: 'Portugues', gl: 'Galego',
};

function StatCard({ label, value, icon, color, subtitle }: {
  label: string; value: string | number; icon: string; color: string; subtitle?: string;
}) {
  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={icon} />
          </svg>
        </div>
      </div>
      <p className="text-2xl font-bold" style={{ color: 'var(--rd-text)' }}>{value}</p>
      <p className="text-[11px] mt-0.5" style={{ color: 'var(--rd-text-muted)' }}>{label}</p>
      {subtitle && <p className="text-[10px] mt-1" style={{ color: 'var(--rd-text-muted)' }}>{subtitle}</p>}
    </div>
  );
}

function HorizontalBar({ data, colorMap, labelMap }: {
  data: Record<string, number>;
  colorMap?: Record<string, { color: string; gradient: string }>;
  labelMap?: Record<string, string>;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => {
        const pct = (value / max) * 100;
        const meta = colorMap?.[key];
        const color = meta?.color || '#64748b';
        const gradient = meta?.gradient || color;
        const label = labelMap?.[key] || key;
        const share = total > 0 ? ((value / total) * 100).toFixed(0) : '0';

        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: gradient }} />
                <span className="text-xs font-medium capitalize" style={{ color: 'var(--rd-text)' }}>
                  {label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--rd-text)' }}>{value}</span>
                <span className="text-[10px] font-medium tabular-nums" style={{ color: 'var(--rd-text-muted)' }}>
                  {share}%
                </span>
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--rd-surface-hover)' }}>
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%`, background: gradient }}
              />
            </div>
          </div>
        );
      })}
      {entries.length === 0 && (
        <p className="text-xs text-center py-6" style={{ color: 'var(--rd-text-muted)' }}>Sin datos</p>
      )}
    </div>
  );
}

function CsatVisual({ value }: { value: number }) {
  const faces = ['😠', '😕', '😐', '🙂', '🤩'];
  const activeIdx = Math.round(value) - 1;
  const color = value >= 4 ? '#10b981' : value >= 3 ? '#f59e0b' : '#ef4444';
  const pct = (value / 5) * 100;

  return (
    <div className="flex flex-col items-center py-4">
      <div className="flex items-center gap-2 mb-4">
        {faces.map((face, i) => (
          <span
            key={i}
            className={`text-2xl transition-all ${i === activeIdx ? 'scale-125' : 'opacity-30 scale-90'}`}
          >
            {face}
          </span>
        ))}
      </div>
      <p className="text-3xl font-bold" style={{ color }}>{value.toFixed(1)}</p>
      <p className="text-[10px] mt-0.5" style={{ color: 'var(--rd-text-muted)' }}>de 5.0</p>
      <div className="w-full h-2 rounded-full mt-4 overflow-hidden" style={{ background: 'var(--rd-surface-hover)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, #ef4444, #f59e0b, #10b981)` }}
        />
      </div>
    </div>
  );
}

function DonutChart({ data, colorMap }: { data: Record<string, number>; colorMap?: Record<string, { color: string }> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total === 0) return <p className="text-xs text-center py-8" style={{ color: 'var(--rd-text-muted)' }}>Sin datos</p>;

  const size = 120;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center py-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {entries.map(([key, value]) => {
            const pct = value / total;
            const dashLength = circumference * pct;
            const color = colorMap?.[key]?.color || '#64748b';
            const seg = (
              <circle
                key={key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            );
            offset += dashLength;
            return seg;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold" style={{ color: 'var(--rd-text)' }}>{total}</span>
          <span className="text-[9px]" style={{ color: 'var(--rd-text-muted)' }}>total</span>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
        {entries.map(([key, value]) => {
          const color = colorMap?.[key]?.color || '#64748b';
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-[10px] font-medium" style={{ color: 'var(--rd-text-secondary)' }}>
                {key} ({value})
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Analytics() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAnalytics()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 h-full">
        <div className="grid grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card">
              <div className="skeleton w-10 h-10 rounded-xl mb-3" />
              <div className="skeleton w-16 h-7 mb-1" />
              <div className="skeleton w-24 h-3" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="stat-card"><div className="skeleton w-full h-40" /></div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="p-6 overflow-y-auto h-full animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6 stagger">
        <StatCard
          label="Conversaciones"
          value={stats.totalConversations}
          color="#3B82F6"
          icon="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        />
        <StatCard
          label="Leads captados"
          value={stats.totalLeads}
          color="#10B981"
          icon="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8"
        />
        <StatCard
          label="Tiempo respuesta"
          value={stats.avgResponseTime ? `${stats.avgResponseTime.toFixed(1)}s` : '-'}
          color="#F59E0B"
          icon="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2"
        />
        <StatCard
          label="CSAT medio"
          value={stats.csatAvg?.toFixed(1) || '-'}
          color="#8B5CF6"
          icon="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-4">
        {/* Business line distribution */}
        <div className="rounded-2xl p-5 shadow-sm" style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)' }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--rd-text)' }}>Por linea de negocio</h3>
          <DonutChart data={stats.byBusinessLine || {}} colorMap={LINE_META} />
        </div>

        {/* Language distribution */}
        <div className="rounded-2xl p-5 shadow-sm" style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)' }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--rd-text)' }}>Por idioma</h3>
          <HorizontalBar data={stats.byLanguage || {}} labelMap={LANG_NAMES} />
        </div>

        {/* CSAT */}
        <div className="rounded-2xl p-5 shadow-sm" style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)' }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--rd-text)' }}>Satisfaccion (CSAT)</h3>
          {stats.csatAvg ? (
            <CsatVisual value={stats.csatAvg} />
          ) : (
            <div className="flex flex-col items-center py-8">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--rd-text-muted)" strokeWidth="1.5" className="opacity-30 mb-2">
                <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
              <p className="text-xs" style={{ color: 'var(--rd-text-muted)' }}>Sin datos de CSAT</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
