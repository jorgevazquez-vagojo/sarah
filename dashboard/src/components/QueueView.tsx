import React from 'react';

interface QueueItem {
  conversationId: string;
  visitorId: string;
  language: string;
  businessLine: string;
  lastMessage?: string;
}

interface Props {
  items: QueueItem[];
  onAccept: (conversationId: string) => void;
  activeConvId: string | null;
}

const LINE_COLORS: Record<string, string> = {
  boostic: 'bg-blue-100 text-blue-700',
  binnacle: 'bg-purple-100 text-purple-700',
  marketing: 'bg-green-100 text-green-700',
  tech: 'bg-orange-100 text-orange-700',
};

const LANG_FLAGS: Record<string, string> = {
  es: '🇪🇸',
  gl: '🇬🇱',
  en: '🇬🇧',
  'es-MX': '🇲🇽',
};

export function QueueView({ items, onAccept, activeConvId }: Props) {
  return (
    <div className="w-80 border-r border-gray-200 bg-white overflow-y-auto">
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">Cola de espera</h2>
      </div>
      {items.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-400">
          No hay conversaciones en espera
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {items.map((item) => (
            <div
              key={item.conversationId}
              className={`p-3 hover:bg-gray-50 cursor-pointer ${
                activeConvId === item.conversationId ? 'bg-red-50' : ''
              }`}
              onClick={() => onAccept(item.conversationId)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">
                  {LANG_FLAGS[item.language] || ''} {item.visitorId.slice(0, 8)}...
                </span>
                {item.businessLine && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${LINE_COLORS[item.businessLine] || 'bg-gray-100 text-gray-600'}`}>
                    {item.businessLine}
                  </span>
                )}
              </div>
              {item.lastMessage && (
                <p className="text-xs text-gray-600 truncate">{item.lastMessage}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
