import React from 'react';

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

const LINE_META: Record<string, { color: string; bg: string; label: string }> = {
  boostic: { color: 'text-blue-700', bg: 'bg-blue-50', label: 'SEO & Growth' },
  binnacle: { color: 'text-purple-700', bg: 'bg-purple-50', label: 'Business Intelligence' },
  marketing: { color: 'text-green-700', bg: 'bg-green-50', label: 'Marketing Digital' },
  tech: { color: 'text-orange-700', bg: 'bg-orange-50', label: 'Desarrollo Tech' },
};

const LANG_META: Record<string, { flag: string; name: string }> = {
  es: { flag: 'ES', name: 'Espanol' },
  en: { flag: 'EN', name: 'English' },
  pt: { flag: 'PT', name: 'Portugues' },
  fr: { flag: 'FR', name: 'Francais' },
  de: { flag: 'DE', name: 'Deutsch' },
  it: { flag: 'IT', name: 'Italiano' },
  nl: { flag: 'NL', name: 'Nederlands' },
  zh: { flag: 'ZH', name: 'Chinese' },
  ja: { flag: 'JA', name: 'Japanese' },
  ko: { flag: 'KO', name: 'Korean' },
  ar: { flag: 'AR', name: 'Arabic' },
  gl: { flag: 'GL', name: 'Galego' },
};

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function QueueView({ items, onAccept, activeConvId }: Props) {
  return (
    <div className="w-80 border-r border-slate-200/60 bg-white flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Cola de espera</h2>
        <span className="badge badge-gray">{items.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 px-4">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 opacity-30">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p className="text-xs text-center">Sin conversaciones en espera</p>
          </div>
        ) : (
          <div className="py-1">
            {items.map((item) => {
              const line = LINE_META[item.businessLine];
              const lang = LANG_META[item.language] || { flag: item.language?.toUpperCase(), name: item.language };
              const isActive = activeConvId === item.conversationId;

              return (
                <div
                  key={item.conversationId}
                  className={`px-3 py-3 mx-2 my-0.5 rounded-xl cursor-pointer transition-all animate-slideIn ${
                    isActive ? 'bg-red-50 border border-red-200' : 'hover:bg-slate-50 border border-transparent'
                  }`}
                  onClick={() => onAccept(item.conversationId)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center">
                        <span className="text-[10px] font-bold text-slate-500">
                          {item.visitorId.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-slate-700">
                          {item.visitorId.slice(0, 8)}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-semibold text-slate-400">{lang.flag}</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400">{timeAgo(item.createdAt)}</span>
                  </div>

                  {item.lastMessage && (
                    <p className="text-xs text-slate-500 truncate ml-8 mb-1.5">{item.lastMessage}</p>
                  )}

                  {line && (
                    <div className="ml-8">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${line.bg} ${line.color}`}>
                        {line.label}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
