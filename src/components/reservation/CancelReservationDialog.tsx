'use client';

import type { ButtonProps } from '@/components/ui/button';
import type { Reservation } from '@/types/reservation';

import { ReservationReasonDialog } from './ReservationReasonDialog';

interface Props {
  reservation: Reservation;
  className?: string;
  disabled?: boolean;
  size?: ButtonProps['size'];
  /** Resolve a named `{ ok: false }` result to keep the dialog open. */
  onConfirmCancel?: (payload: {
    id: string;
    reason: string;
  }) => Promise<unknown> | unknown;
}

/** Compatibility export: the cancel flavor of `ReservationReasonDialog` (#977). */
export default function CancelReservationDialog({
  onConfirmCancel,
  ...props
}: Props) {
  return (
    <ReservationReasonDialog
      kind="cancel"
      onSubmit={onConfirmCancel}
      {...props}
    />
  );
}
