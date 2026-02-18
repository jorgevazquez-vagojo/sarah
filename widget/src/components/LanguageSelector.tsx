import React from 'react';

const LANGUAGES = [
  { code: 'gl', label: 'Galego', flag: '🇬🇱' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es-MX', label: 'México', flag: '🇲🇽' },
];

interface Props {
  current: string;
  onChange: (lang: string) => void;
}

export function LanguageSelector({ current, onChange }: Props) {
  return (
    <div className="rc-flex rc-gap-1 rc-px-3 rc-py-1.5 rc-border-b rc-border-gray-100 rc-bg-gray-50">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => onChange(lang.code)}
          className={`rc-px-2 rc-py-0.5 rc-text-xs rc-rounded rc-border-0 rc-cursor-pointer rc-transition-colors ${
            current === lang.code
              ? 'rc-bg-white rc-shadow-sm rc-font-semibold'
              : 'rc-bg-transparent hover:rc-bg-white/50'
          }`}
          title={lang.label}
        >
          {lang.flag} {lang.label}
        </button>
      ))}
    </div>
  );
}
