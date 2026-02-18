import React, { useState } from 'react';
import { useLanguage } from '../hooks/useLanguage';

interface Props {
  language: string;
  primaryColor: string;
  onSubmit: (data: { name: string; email: string; phone?: string; company?: string }) => void;
}

export function LeadForm({ language, primaryColor, onSubmit }: Props) {
  const { t } = useLanguage(language);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    onSubmit({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, company: company.trim() || undefined });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="rc-p-6 rc-text-center">
        <div className="rc-text-3xl rc-mb-2">✓</div>
        <p className="rc-text-sm rc-text-gray-700">{t('thanks')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rc-p-4 rc-space-y-3">
      <div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('name')}
          required
          className="rc-w-full rc-px-3 rc-py-2 rc-border rc-border-gray-200 rc-rounded-lg rc-text-sm rc-outline-none focus:rc-border-gray-400"
        />
      </div>
      <div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('email')}
          required
          className="rc-w-full rc-px-3 rc-py-2 rc-border rc-border-gray-200 rc-rounded-lg rc-text-sm rc-outline-none focus:rc-border-gray-400"
        />
      </div>
      <div>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t('phone')}
          className="rc-w-full rc-px-3 rc-py-2 rc-border rc-border-gray-200 rc-rounded-lg rc-text-sm rc-outline-none focus:rc-border-gray-400"
        />
      </div>
      <button
        type="submit"
        className="rc-w-full rc-py-2 rc-text-white rc-rounded-lg rc-text-sm rc-font-medium rc-border-0 rc-cursor-pointer hover:rc-opacity-90"
        style={{ backgroundColor: primaryColor }}
      >
        {t('submit')}
      </button>
    </form>
  );
}
