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
  optional?: boolean;
  requiredPosition?: 'prefix' | 'suffix';
  noBorderTop?: boolean;
  variant?: 'default' | 'card' | 'inline' | 'option-a';
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
  optional = false,
  requiredPosition = 'prefix',
  noBorderTop = false,
  variant = 'default',
  subtitle,
  headerAction,
  dataTestId,
  className,
}: SectionProps) => {
  const renderTitleContent = () => (
    <>
      {requiredPosition === 'prefix' && <RequiredIndicator show={required} />}
      {title}
      {requiredPosition === 'suffix' && required && (
        <span className="text-status-error-default ml-1" aria-hidden="true">
          *
        </span>
      )}
      {!required && optional && (
        <span className="text-text-tertiary ml-2 text-xs font-normal">
          選填
        </span>
      )}
    </>
  );

  if (variant === 'inline') {
    return (
      <div
        id={id}
        data-testid={dataTestId}
        className={cn('min-w-0', className)}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-text-primary text-sm font-bold">
            {renderTitleContent()}
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
              {renderTitleContent()}
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

  if (variant === 'option-a') {
    return (
      <div
        id={id}
        data-testid={dataTestId}
        className={cn(
          'flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8',
          !noBorderTop && 'border-background-border border-t pt-8',
          className
        )}
      >
        <div className="lg:w-48 lg:shrink-0">
          <p className="text-text-primary text-sm font-bold">
            {renderTitleContent()}
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
        <p className="mb-4 text-xl font-bold">{renderTitleContent()}</p>
      </div>
      <div className="grow">{children}</div>
    </div>
  );
};
