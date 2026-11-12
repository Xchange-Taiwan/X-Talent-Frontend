import { useCallback } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { trackEvent } from '@/lib/analytics';
import {
  acceptReservation,
  rejectOrCancelReservation,
  submitReservationFeedback,
} from '@/services/reservations';
import { Reservation } from '@/types/reservation';
import type { SubmitReservationFeedbackRequest } from '@/types/reservationFeedback';

export type Variant =
  'upcoming' | 'pending-mentee' | 'pending-mentor' | 'history';

interface UseReservationActionsProps {
  myUserId: string | undefined;
  variant?: Variant;
  /** Which side `myUserId` is acting as for these reservations - forwarded
   * to the mutation service so it knows which parties' cache slots to
   * invalidate after a successful write. */
  myRole: 'mentee' | 'mentor';
  onMutationSuccess?: (id: string) => void | Promise<void>;
}

interface UseReservationActionsReturn {
  accept: (reservation: Reservation, message: string) => Promise<void>;
  rejectOrCancel: (
    reservation: Reservation,
    text: string,
    action: 'reject' | 'cancel'
  ) => Promise<void>;
  submitFeedback: (
    reservation: Reservation,
    payload: SubmitReservationFeedbackRequest
  ) => Promise<void>;
  isMutating: boolean;
}

export function useReservationActions({
  myUserId,
  myRole,
  onMutationSuccess,
}: UseReservationActionsProps): UseReservationActionsReturn {
  const { toast } = useToast();
  // No errorMessage/errorTitle here: the caller (a reservation confirm
  // dialog via useConfirmActionDialog) already owns the sole user-facing
  // error toast for this action, keyed off the same rethrown error. Adding
  // one here too would show two toasts back-to-back for every failure.
  const { run, isPending: isMutating } = useAsyncAction({
    throwError: true,
  });

  const accept = useCallback(
    async (reservation: Reservation, message: string) => {
      await run(async () => {
        await acceptReservation({
          message,
          reservation,
          myUserId,
          myRole,
        });
        toast({
          title: '已接受預約',
          description: '會議連結將於數分鐘內寄至雙方信箱',
        });
        await onMutationSuccess?.(reservation.id);
      });
    },
    [run, myUserId, myRole, toast, onMutationSuccess]
  );

  const rejectOrCancel = useCallback(
    async (
      reservation: Reservation,
      text: string,
      action: 'reject' | 'cancel'
    ) => {
      await run(async () => {
        await rejectOrCancelReservation({
          text,
          reservation,
          myUserId,
          myRole,
        });
        trackEvent({ name: 'reservation_rejected', feature: 'reservation' });
        const successMessage =
          action === 'reject' ? '已拒絕預約' : '已取消預約';
        toast({ description: successMessage });
        await onMutationSuccess?.(reservation.id);
      });
    },
    [run, myUserId, myRole, toast, onMutationSuccess]
  );

  const submitFeedback = useCallback(
    async (
      reservation: Reservation,
      payload: SubmitReservationFeedbackRequest
    ) => {
      await run(async () => {
        await submitReservationFeedback({
          reservation,
          myUserId,
          myRole,
          payload,
        });
        trackEvent({
          name: 'reservation_feedback_submitted',
          feature: 'reservation',
          metadata: { meeting_happened: payload.meeting_happened },
        });
        await onMutationSuccess?.(reservation.id);
      });
    },
    [run, myUserId, myRole, onMutationSuccess]
  );

  return {
    accept,
    rejectOrCancel,
    submitFeedback,
    isMutating,
  };
}
