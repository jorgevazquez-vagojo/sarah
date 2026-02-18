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

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  new: { label: 'Nuevo', bg: 'bg-blue-50', color: 'text-blue-700' },
  contacted: { label: 'Contactado', bg: 'bg-yellow-50', color: 'text-yellow-700' },
  qualified: { label: 'Cualificado', bg: 'bg-green-50', color: 'text-green-700' },
  converted: { label: 'Convertido', bg: 'bg-emerald-50', color: 'text-emerald-700' },
  lost: { label: 'Perdido', bg: 'bg-slate-100', color: 'text-slate-500' },
};

const LINE_COLORS: Record<string, string> = {
  boostic: 'badge-blue',
  binnacle: 'badge-purple',
  marketing: 'badge-green',
  tech: 'badge-orange',
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'text-green-600 bg-green-50' : score >= 40 ? 'text-yellow-600 bg-yellow-50' : 'text-slate-500 bg-slate-100';
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{score}</span>;
}

export function LeadsList() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="p-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Leads</h2>
          <p className="text-xs text-slate-400 mt-0.5">{filtered.length} leads en total</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 w-48"
            />
          </div>
          {/* Filters */}
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
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  filter === f.value
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="px-5 py-3">Nombre</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Empresa</th>
              <th className="px-5 py-3">Linea</th>
              <th className="px-5 py-3">Score</th>
              <th className="px-5 py-3">Estado</th>
              <th className="px-5 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-xs">Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-xs">No hay leads</td></tr>
            ) : (
              filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-slate-700">{lead.name || '-'}</span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{lead.email || '-'}</td>
                  <td className="px-5 py-3.5 text-slate-500">{lead.company || '-'}</td>
                  <td className="px-5 py-3.5">
                    {lead.business_line ? (
                      <span className={`badge ${LINE_COLORS[lead.business_line] || 'badge-gray'}`}>
                        {lead.business_line}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-5 py-3.5">
                    <ScoreBadge score={lead.quality_score || 0} />
                  </td>
                  <td className="px-5 py-3.5">
                    <select
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border-0 cursor-pointer ${
                        STATUS_META[lead.status]?.bg || ''
                      } ${STATUS_META[lead.status]?.color || ''}`}
                    >
                      {Object.entries(STATUS_META).map(([val, meta]) => (
                        <option key={val} value={val}>{meta.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-400">
                    {new Date(lead.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
