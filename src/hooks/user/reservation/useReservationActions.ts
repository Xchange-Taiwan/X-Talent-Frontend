import { useCallback } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { clearUserProfileDtoCache } from '@/hooks/user/user-data/userProfileDtoCache';
import { trackEvent } from '@/lib/analytics';
import { resolveCounterpartyId } from '@/lib/reservation/resolveCounterparty';
import {
  acceptReservation,
  rejectOrCancelReservation,
  submitReservationFeedback,
  updateReservationFeedback,
} from '@/services/reservations';
import { Reservation } from '@/types/reservation';
import type {
  SubmitReservationFeedbackRequest,
  UpdateReservationFeedbackRequest,
} from '@/types/reservationFeedback';

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
  updateFeedback: (
    reservation: Reservation,
    payload: UpdateReservationFeedbackRequest
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
        if (payload.meeting_happened && myUserId) {
          const counterpartyId = Number(
            resolveCounterpartyId(reservation, myUserId)
          );
          if (Number.isFinite(counterpartyId) && counterpartyId > 0) {
            clearUserProfileDtoCache(counterpartyId, 'zh_TW');
            clearUserProfileDtoCache(counterpartyId, 'en_US');
          }
        }
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

  const updateFeedback = useCallback(
    async (
      reservation: Reservation,
      payload: UpdateReservationFeedbackRequest
    ) => {
      await run(async () => {
        await updateReservationFeedback({
          reservation,
          myUserId,
          myRole,
          payload,
        });
        if (myUserId && reservation.feedback?.rating?.isPublic !== false) {
          const counterpartyId = Number(
            resolveCounterpartyId(reservation, myUserId)
          );
          if (Number.isFinite(counterpartyId) && counterpartyId > 0) {
            clearUserProfileDtoCache(counterpartyId, 'zh_TW');
            clearUserProfileDtoCache(counterpartyId, 'en_US');
          }
        }
        trackEvent({
          name: 'reservation_feedback_updated',
          feature: 'reservation',
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
    updateFeedback,
    isMutating,
  };
}
