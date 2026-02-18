import React from 'react';

interface Props {
  status: string;
  onChange: (status: string) => void;
}

const STATUS_OPTIONS = [
  { value: 'online', label: 'Disponible', color: 'bg-green-500' },
  { value: 'busy', label: 'Ocupado', color: 'bg-yellow-500' },
  { value: 'away', label: 'Ausente', color: 'bg-gray-400' },
];

export function AgentStatus({ status, onChange }: Props) {
  const current = STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 text-sm">
        <span className={`w-2.5 h-2.5 rounded-full ${current.color}`} />
        {current.label}
      </button>
      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 hidden group-hover:block z-10">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50"
          >
            <span className={`w-2 h-2 rounded-full ${opt.color}`} />
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
