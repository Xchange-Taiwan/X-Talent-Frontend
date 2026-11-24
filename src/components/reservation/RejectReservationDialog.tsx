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
  onReject?: (payload: {
    id: string;
    reason: string;
  }) => Promise<unknown> | unknown;
}

/** Compatibility export: the mentor-side reject flavor of `ReservationReasonDialog` (#977). */
export default function RejectReservationDialog({ onReject, ...props }: Props) {
  return (
    <ReservationReasonDialog kind="reject" onSubmit={onReject} {...props} />
  );
}
