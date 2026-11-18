import React from 'react';

export interface StatusRecoveryCardProps {
  badge?: React.ReactNode;
  title: string;
  description: string;
  actions: React.ReactNode;
  role?: 'alert' | 'region';
}

export default function StatusRecoveryCard({
  badge,
  title,
  description,
  actions,
  role,
}: StatusRecoveryCardProps) {
  return (
    <div
      role={role}
      className="border-background-border bg-background-white mx-auto flex w-full max-w-md flex-col items-center rounded-2xl border px-6 py-10 text-center shadow-sm"
    >
      {badge}
      <h2 className="text-navy mb-2 text-xl font-bold">{title}</h2>
      <p className="text-text-secondary mb-6 text-sm leading-relaxed">
        {description}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {actions}
      </div>
    </div>
  );
}
