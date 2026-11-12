'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export interface FeedbackRadioOptionProps {
  name: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  value?: string;
  density?: 'default' | 'compact';
  onSelect: () => void;
}

export function FeedbackRadioOption({
  name,
  label,
  checked,
  disabled = false,
  value,
  density = 'default',
  onSelect,
}: FeedbackRadioOptionProps) {
  return (
    <label
      className={cn(
        'focus-within:ring-brand-500 flex cursor-pointer items-center gap-2.5 rounded-md border px-3.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-offset-1',
        density === 'compact' ? 'py-2' : 'py-3',
        disabled && 'pointer-events-none opacity-60',
        checked
          ? 'border-text-primary bg-background-white text-text-primary ring-text-primary font-medium ring-1'
          : 'border-background-border bg-background-white text-text-primary hover:bg-background-hover'
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        className="sr-only"
        disabled={disabled}
        checked={checked}
        onChange={onSelect}
      />
      <span
        aria-hidden="true"
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
          checked ? 'border-text-primary border-2' : 'border-text-tertiary'
        )}
      >
        {checked ? (
          <span className="bg-text-primary size-2 rounded-full" />
        ) : null}
      </span>
      <span>{label}</span>
    </label>
  );
}
