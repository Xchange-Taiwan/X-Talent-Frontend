'use client';

import { cva } from 'class-variance-authority';
import * as React from 'react';

import { useReservationTimeStatus } from '@/hooks/reservation/useReservationTimeStatus';
import { cn } from '@/lib/utils';

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none sm:text-xs',
  {
    variants: {
      status: {
        far: 'bg-muted text-muted-foreground',
        soon: 'bg-status-500/20 text-status-400',
        imminent: 'bg-status-300/20 text-status-200',
        live: 'bg-status-100/20 text-status-50',
        ended: 'bg-muted text-muted-foreground/70',
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
          className="h-1.5 w-1.5 rounded-full bg-status-50 motion-safe:animate-pulse"
          aria-hidden
        />
      ) : null}
      {label}
    </span>
  );
}
