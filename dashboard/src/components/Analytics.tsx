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

export function Analytics() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.getAnalytics().then(setStats).catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="p-6 text-center text-gray-400">Cargando analytics...</div>
    );
  }

  const cards = [
    { label: 'Conversaciones', value: stats.totalConversations, color: 'text-blue-600' },
    { label: 'Leads captados', value: stats.totalLeads, color: 'text-green-600' },
    { label: 'Tiempo respuesta (s)', value: stats.avgResponseTime?.toFixed(1) || '-', color: 'text-yellow-600' },
    { label: 'CSAT medio', value: stats.csatAvg?.toFixed(1) || '-', color: 'text-purple-600' },
  ];

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Analytics</h2>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Por línea de negocio</h3>
          {stats.byBusinessLine && Object.entries(stats.byBusinessLine).map(([line, count]) => (
            <div key={line} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-gray-600 capitalize">{line}</span>
              <span className="font-medium">{count}</span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Por idioma</h3>
          {stats.byLanguage && Object.entries(stats.byLanguage).map(([lang, count]) => (
            <div key={lang} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-gray-600">{lang}</span>
              <span className="font-medium">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
