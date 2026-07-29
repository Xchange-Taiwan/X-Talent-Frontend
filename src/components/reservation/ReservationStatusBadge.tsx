'use client';

import { cva } from 'class-variance-authority';
import * as React from 'react';

import { useReservationTimeStatus } from '@/hooks/reservation/useReservationTimeStatus';
import { cn } from '@/lib/utils';

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-11 font-medium leading-none sm:text-xs',
  {
    variants: {
      status: {
        far: 'bg-background-bottom text-text-tertiary',
        soon: 'bg-status-warning-active/20 text-status-warning-default',
        imminent: 'bg-status-error-active/20 text-status-error-default',
        live: 'bg-status-success-active/20 text-status-success-default',
        ended: 'bg-background-bottom text-text-tertiary/70',
      },
    },
    defaultVariants: {
      status: 'far',
    },
  }
);

export function ReservationStatusBadge({
  dtstart,
  dtend,
  className,
}: {
  dtstart: number;
  dtend: number;
  className?: string;
}) {
  const { status, label } = useReservationTimeStatus(dtstart, dtend);

  return (
    <span
      className={cn(statusBadgeVariants({ status }), className)}
      role="status"
      aria-live="polite"
    >
      {status === 'live' ? (
        <span
          className="h-1.5 w-1.5 rounded-full bg-status-success-default motion-safe:animate-pulse"
          aria-hidden
        />
      ) : null}
      {label}
    </span>
  );
}
