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
  variant?: 'default' | 'card' | 'inline';
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
  if (variant === 'inline') {
    return (
      <div
        id={id}
        data-testid={dataTestId}
        className={cn('min-w-0', className)}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-text-primary text-sm font-bold">
            <RequiredIndicator show={required} />
            {title}
          </p>
          {headerAction}
        </div>
        {subtitle && (
          <p className="text-text-tertiary mb-2 text-xs">{subtitle}</p>
        )}
        {children}
      </div>
    );
  }

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
        'border-background-border flex flex-col gap-4 border-t pt-8 lg:flex-row lg:items-start lg:gap-8',
        className
      )}
    >
      <div className="lg:w-48 lg:shrink-0">
        <p className="text-text-primary text-sm font-bold">
          <RequiredIndicator show={required} />
          {title}
        </p>
        {subtitle && (
          <p className="text-text-tertiary mt-1.5 text-xs leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {children}
        {headerAction && (
          <div className="mt-1.5 flex justify-end">{headerAction}</div>
        )}
      </div>
    </div>
  );
};
