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

const LINE_COLORS: Record<string, string> = {
  boostic: '#3B82F6',
  binnacle: '#8B5CF6',
  marketing: '#10B981',
  tech: '#F59E0B',
};

const LANG_NAMES: Record<string, string> = {
  es: 'Espanol', en: 'English', pt: 'Portugues', fr: 'Francais',
  de: 'Deutsch', it: 'Italiano', nl: 'Nederlands', zh: 'Chinese',
  ja: 'Japanese', ko: 'Korean', ar: 'Arabic', gl: 'Galego',
};

function StatCard({ label, value, color, icon, subtitle }: { label: string; value: string | number; color: string; icon: string; subtitle?: string }) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-opacity-10 ${color}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={color.replace('bg-', 'text-')}>
            <path d={icon} />
          </svg>
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {subtitle && <p className="text-[10px] text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function BarChart({ data, colorMap }: { data: Record<string, number>; colorMap?: Record<string, string> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="space-y-2.5">
      {entries.map(([key, value]) => {
        const pct = (value / max) * 100;
        const color = colorMap?.[key] || '#64748b';
        return (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-600 capitalize">{LANG_NAMES[key] || key}</span>
              <span className="text-xs font-bold text-slate-700">{value}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
      {entries.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-4">Sin datos</p>
      )}
    </div>
  );
}

function CsatVisual({ value }: { value: number }) {
  const stars = Math.round(value);
  const pct = (value / 5) * 100;
  const color = value >= 4 ? 'text-green-500' : value >= 3 ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="flex flex-col items-center py-4">
      <div className="flex items-center gap-0.5 mb-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} width="20" height="20" viewBox="0 0 24 24" fill={i <= stars ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className={i <= stars ? color : 'text-slate-300'}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        ))}
      </div>
      <p className={`text-xl font-bold ${color}`}>{value.toFixed(1)}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">de 5.0</p>
      <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500" style={{ width: `${pct}%` }} />
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
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center">
          <svg className="animate-spin w-6 h-6 text-slate-400 mx-auto mb-2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" /></svg>
          <p className="text-xs text-slate-400">Cargando analytics...</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="p-6 overflow-y-auto animate-fadeIn">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Analytics</h2>
          <p className="text-xs text-slate-400 mt-0.5">Resumen general</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Conversaciones"
          value={stats.totalConversations}
          color="bg-blue-100"
          icon="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        />
        <StatCard
          label="Leads captados"
          value={stats.totalLeads}
          color="bg-green-100"
          icon="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8"
        />
        <StatCard
          label="Tiempo respuesta"
          value={stats.avgResponseTime ? `${stats.avgResponseTime.toFixed(1)}s` : '-'}
          color="bg-yellow-100"
          icon="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 6v6l4 2"
        />
        <StatCard
          label="CSAT medio"
          value={stats.csatAvg?.toFixed(1) || '-'}
          color="bg-purple-100"
          icon="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Por linea de negocio</h3>
          <BarChart data={stats.byBusinessLine || {}} colorMap={LINE_COLORS} />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Por idioma</h3>
          <BarChart data={stats.byLanguage || {}} />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Satisfaccion (CSAT)</h3>
          {stats.csatAvg ? (
            <CsatVisual value={stats.csatAvg} />
          ) : (
            <p className="text-xs text-slate-400 text-center py-8">Sin datos de CSAT</p>
          )}
        </div>
      </div>
    </div>
  );
}
