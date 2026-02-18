import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  business_line: string;
  language: string;
  quality_score: number;
  status: string;
  created_at: string;
  notes?: string;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  new: { label: 'Nuevo', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', dot: '#3b82f6' },
  contacted: { label: 'Contactado', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', dot: '#f59e0b' },
  qualified: { label: 'Cualificado', color: '#10b981', bg: 'rgba(16,185,129,0.08)', dot: '#10b981' },
  converted: { label: 'Convertido', color: '#059669', bg: 'rgba(5,150,105,0.08)', dot: '#059669' },
  lost: { label: 'Perdido', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', dot: '#94a3b8' },
};

const LINE_BADGES: Record<string, string> = {
  boostic: 'badge-blue',
  binnacle: 'badge-purple',
  marketing: 'badge-green',
  tech: 'badge-orange',
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#94a3b8';
  const bg = score >= 70 ? 'rgba(16,185,129,0.1)' : score >= 40 ? 'rgba(245,158,11,0.1)' : 'rgba(148,163,184,0.1)';
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color, background: bg }}>
      {score}
    </span>
  );
}

function KpiCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={icon} />
          </svg>
        </div>
      </div>
      <p className="text-2xl font-bold" style={{ color: 'var(--rd-text)' }}>{value}</p>
      <p className="text-[11px] mt-0.5" style={{ color: 'var(--rd-text-muted)' }}>{label}</p>
    </div>
  );
}

export function LeadsList() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  useEffect(() => {
    setLoading(true);
    api.getLeads(filter ? { status: filter } : undefined)
      .then(setLeads)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  const handleStatusChange = async (id: string, status: string) => {
    await api.updateLead(id, { status });
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
  };

  const filtered = search
    ? leads.filter((l) =>
        (l.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.company || '').toLowerCase().includes(search.toLowerCase())
      )
    : leads;

  const kpis = {
    total: leads.length,
    newCount: leads.filter((l) => l.status === 'new').length,
    qualified: leads.filter((l) => l.status === 'qualified').length,
    avgScore: leads.length > 0
      ? Math.round(leads.reduce((sum, l) => sum + (l.quality_score || 0), 0) / leads.length)
      : 0,
  };

  return (
    <div className="p-6 overflow-y-auto h-full animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6 stagger">
        <KpiCard label="Total leads" value={kpis.total} icon="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8" color="#3b82f6" />
        <KpiCard label="Nuevos" value={kpis.newCount} icon="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" color="#f59e0b" />
        <KpiCard label="Cualificados" value={kpis.qualified} icon="M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3" color="#10b981" />
        <KpiCard label="Score medio" value={kpis.avgScore} icon="M13 2L3 14h9l-1 8 10-12h-9l1-8z" color="#8b5cf6" />
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--rd-text-muted)" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar leads..."
              className="input-field pl-9 !w-52"
            />
          </div>
          <div className="flex gap-1">
            {[
              { value: '', label: 'Todos' },
              { value: 'new', label: 'Nuevos' },
              { value: 'contacted', label: 'Contactados' },
              { value: 'qualified', label: 'Cualificados' },
              { value: 'converted', label: 'Convertidos' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                  filter === f.value
                    ? 'text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                style={filter === f.value
                  ? { background: 'linear-gradient(135deg, var(--rd-primary), var(--rd-primary-dark))' }
                  : { background: 'var(--rd-surface)', border: '1px solid var(--rd-border-strong)' }
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs font-medium" style={{ color: 'var(--rd-text-muted)' }}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="px-5 py-3.5">Nombre</th>
              <th className="px-5 py-3.5">Email</th>
              <th className="px-5 py-3.5">Empresa</th>
              <th className="px-5 py-3.5">Linea</th>
              <th className="px-5 py-3.5">Score</th>
              <th className="px-5 py-3.5">Estado</th>
              <th className="px-5 py-3.5">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="px-5 py-4">
                    <div className="skeleton h-4 w-full" />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--rd-text-muted)" strokeWidth="1.5" className="mx-auto mb-2 opacity-30">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  </svg>
                  <p className="text-xs" style={{ color: 'var(--rd-text-muted)' }}>No hay leads</p>
                </td>
              </tr>
            ) : (
              filtered.map((lead, i) => {
                const statusMeta = STATUS_META[lead.status] || STATUS_META.new;
                return (
                  <tr
                    key={lead.id}
                    className="transition-colors cursor-pointer animate-fade-in"
                    style={{ borderBottom: '1px solid var(--rd-border)', animationDelay: `${i * 30}ms` }}
                    onClick={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--rd-surface-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-semibold" style={{ color: 'var(--rd-text)' }}>{lead.name || '-'}</span>
                    </td>
                    <td className="px-5 py-3.5" style={{ color: 'var(--rd-text-secondary)' }}>{lead.email || '-'}</td>
                    <td className="px-5 py-3.5" style={{ color: 'var(--rd-text-secondary)' }}>{lead.company || '-'}</td>
                    <td className="px-5 py-3.5">
                      {lead.business_line ? (
                        <span className={`badge ${LINE_BADGES[lead.business_line] || 'badge-gray'}`}>
                          {lead.business_line}
                        </span>
                      ) : <span style={{ color: 'var(--rd-text-muted)' }}>-</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <ScoreBadge score={lead.quality_score || 0} />
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={lead.status}
                        onChange={(e) => { e.stopPropagation(); handleStatusChange(lead.id, e.target.value); }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg border-0 cursor-pointer"
                        style={{ background: statusMeta.bg, color: statusMeta.color }}
                      >
                        {Object.entries(STATUS_META).map(([val, meta]) => (
                          <option key={val} value={val}>{meta.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--rd-text-muted)' }}>
                      {new Date(lead.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Lead detail panel */}
      {selectedLead && (
        <LeadDetail lead={selectedLead} onClose={() => setSelectedLead(null)} onStatusChange={handleStatusChange} />
      )}
    </div>
  );
}

function LeadDetail({ lead, onClose, onStatusChange }: { lead: Lead; onClose: () => void; onStatusChange: (id: string, status: string) => void }) {
  const statusMeta = STATUS_META[lead.status] || STATUS_META.new;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl p-6 animate-scale-in"
        style={{ background: 'var(--rd-surface)', border: '1px solid var(--rd-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--rd-text)' }}>{lead.name || 'Sin nombre'}</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--rd-text-muted)' }}>{lead.email}</p>
          </div>
          <button onClick={onClose} className="btn-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <span className="text-[10px] font-medium" style={{ color: 'var(--rd-text-muted)' }}>Empresa</span>
            <p className="text-sm font-medium" style={{ color: 'var(--rd-text)' }}>{lead.company || '-'}</p>
          </div>
          <div>
            <span className="text-[10px] font-medium" style={{ color: 'var(--rd-text-muted)' }}>Telefono</span>
            <p className="text-sm font-medium" style={{ color: 'var(--rd-text)' }}>{lead.phone || '-'}</p>
          </div>
          <div>
            <span className="text-[10px] font-medium" style={{ color: 'var(--rd-text-muted)' }}>Linea</span>
            <p className="text-sm">
              {lead.business_line ? (
                <span className={`badge ${LINE_BADGES[lead.business_line] || 'badge-gray'}`}>{lead.business_line}</span>
              ) : '-'}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-medium" style={{ color: 'var(--rd-text-muted)' }}>Score</span>
            <p className="text-sm"><ScoreBadge score={lead.quality_score || 0} /></p>
          </div>
        </div>

        <div className="mb-5">
          <span className="text-[10px] font-medium" style={{ color: 'var(--rd-text-muted)' }}>Estado</span>
          <div className="flex gap-1.5 mt-1.5">
            {Object.entries(STATUS_META).map(([val, meta]) => (
              <button
                key={val}
                onClick={() => onStatusChange(lead.id, val)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
                style={lead.status === val
                  ? { background: meta.bg, color: meta.color, boxShadow: `0 0 0 2px ${meta.color}30` }
                  : { background: 'var(--rd-surface-hover)', color: 'var(--rd-text-muted)' }
                }
              >
                {meta.label}
              </button>
            ))}
          </div>
        </div>

        {lead.notes && (
          <div>
            <span className="text-[10px] font-medium" style={{ color: 'var(--rd-text-muted)' }}>Notas</span>
            <p className="text-xs mt-1 p-3 rounded-xl" style={{ background: 'var(--rd-surface-hover)', color: 'var(--rd-text-secondary)' }}>
              {lead.notes}
            </p>
          </div>
        )}

        <div className="mt-5 pt-4 text-right" style={{ borderTop: '1px solid var(--rd-border)' }}>
          <p className="text-[10px]" style={{ color: 'var(--rd-text-muted)' }}>
            Creado: {new Date(lead.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </div>
  );
}
