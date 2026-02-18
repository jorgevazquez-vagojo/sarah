import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  business_line: string;
  quality_score: number;
  status: string;
  created_at: string;
}

export function LeadsList() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    api.getLeads(filter ? { status: filter } : undefined).then(setLeads).catch(() => {});
  }, [filter]);

  const handleStatusChange = async (id: string, status: string) => {
    await api.updateLead(id, { status });
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
  };

  const STATUS_COLORS: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700',
    contacted: 'bg-yellow-100 text-yellow-700',
    qualified: 'bg-green-100 text-green-700',
    converted: 'bg-emerald-100 text-emerald-700',
    lost: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Leads</h2>
        <div className="flex gap-2">
          {['', 'new', 'contacted', 'qualified', 'converted'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-full ${
                filter === f ? 'bg-redegal text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f || 'Todos'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Línea</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{lead.name || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{lead.email || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{lead.company || '-'}</td>
                <td className="px-4 py-3">
                  <span className="text-xs">{lead.business_line || '-'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-medium">{lead.quality_score}</span>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={lead.status}
                    onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                    className={`text-xs px-2 py-0.5 rounded-full border-0 ${STATUS_COLORS[lead.status] || ''}`}
                  >
                    <option value="new">Nuevo</option>
                    <option value="contacted">Contactado</option>
                    <option value="qualified">Cualificado</option>
                    <option value="converted">Convertido</option>
                    <option value="lost">Perdido</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(lead.created_at).toLocaleDateString('es-ES')}
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No hay leads
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
