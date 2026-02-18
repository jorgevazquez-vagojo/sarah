import React from 'react';
import { useLanguage } from '../hooks/useLanguage';

const LINES = ['boostic', 'binnacle', 'marketing', 'tech'] as const;

interface Props {
  language: string;
  onSelect: (line: string) => void;
}

export function BusinessLineChips({ language, onSelect }: Props) {
  const { t } = useLanguage(language);

  return (
    <div className="rc-px-4 rc-py-3">
      <p className="rc-text-sm rc-text-gray-600 rc-mb-2">{t('select_line')}</p>
      <div className="rc-flex rc-flex-wrap rc-gap-2">
        {LINES.map((line) => (
          <button
            key={line}
            onClick={() => onSelect(line)}
            className="rc-px-3 rc-py-1.5 rc-text-sm rc-bg-gray-100 hover:rc-bg-gray-200 rc-rounded-full rc-border-0 rc-cursor-pointer rc-transition-colors"
          >
            {t(line)}
          </button>
        ))}
      </div>
    </div>
  );
}
