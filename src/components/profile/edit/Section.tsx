import React from 'react';

import { cn } from '@/lib/utils';

import { RequiredIndicator } from './RequiredIndicator';

//--------------------------------------------------
// 🧩 Section Wrapper (Two-column default & Card variant)
//--------------------------------------------------

interface SectionProps {
  title: string | React.ReactNode;
  children: React.ReactNode;
  id?: string;
  required?: boolean;
  variant?: 'default' | 'card';
  subtitle?: string;
  headerAction?: React.ReactNode;
  dataTestId?: string;
  className?: string;
}

export const Section = ({
  title,
  children,
  id,
  required = false,
  variant = 'default',
  subtitle,
  headerAction,
  dataTestId,
  className,
}: SectionProps) => {
  if (variant === 'card') {
    return (
      <section
        id={id}
        data-testid={dataTestId}
        className={cn(
          'border-background-border bg-background-white rounded-2xl border p-6 shadow-sm',
          className
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-text-primary text-xl font-bold">
              <RequiredIndicator show={required} />
              {title}
            </h2>
            {subtitle && (
              <p className="text-text-tertiary mt-1 text-sm">{subtitle}</p>
            )}
          </div>
          {headerAction}
        </div>
        {children}
      </section>
    );
  }

  return (
    <div
      id={id}
      data-testid={dataTestId}
      className={cn(
        'border-background-border flex flex-col border-t-2 border-solid pt-10 lg:flex-row',
        className
      )}
    >
      <div className="max-w-80 grow">
        <p className="mb-4 text-xl font-bold">
          <RequiredIndicator show={required} />
          {title}
        </p>
      </div>
      <div className="grow">{children}</div>
    </div>
  );
};
