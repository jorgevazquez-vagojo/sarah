import React from 'react';

interface Props {
  agentName: string | null;
  primaryColor: string;
}

export function EscalationBanner({ agentName, primaryColor }: Props) {
  if (!agentName) return null;

  return (
    <div className="rc-flex rc-items-center rc-gap-2 rc-px-4 rc-py-2 rc-border-b rc-border-gray-100" style={{ backgroundColor: primaryColor + '10' }}>
      <div className="rc-w-2 rc-h-2 rc-rounded-full rc-bg-green-500" />
      <span className="rc-text-xs rc-text-gray-700">
        <strong>{agentName}</strong> te está atendiendo
      </span>
    </div>
  );
}
