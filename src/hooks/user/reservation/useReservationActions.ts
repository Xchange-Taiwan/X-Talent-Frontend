import { useCallback } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { ConcurrentActionError, useAsyncAction } from '@/hooks/useAsyncAction';
import { trackEvent } from '@/lib/analytics';
import {
  executeReservationDecision,
  type ReservationDecisionKind,
  type ReservationDecisionResult,
} from '@/lib/reservation/executeReservationDecision';
import {
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

/**
 * What a decision call resolves to: the pure module's named result, or
 * `in_flight` when the adapter's re-entry guard dropped a second click.
 * Decision calls never reject - every outcome is already toasted here.
 */
export type ReservationDecisionAttempt =
  ReservationDecisionResult | { ok: false; reason: 'in_flight' };

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
  accept: (
    reservation: Reservation,
    message: string
  ) => Promise<ReservationDecisionAttempt>;
  rejectOrCancel: (
    reservation: Reservation,
    text: string,
    action: 'reject' | 'cancel'
  ) => Promise<ReservationDecisionAttempt>;
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

/**
 * Single React adapter over `executeReservationDecision` (#977): owns the
 * re-entry guard, the success / failure toast, and the post-success
 * callback for accept / reject / cancel. Callers never need an extra
 * wrapper to turn a 409 into a toast.
 *
 * Feedback mutations keep rethrowing - `useMeetingFeedbackForm` owns their
 * conflict and business-rule classification.
 */
export function useReservationActions({
  myUserId,
  myRole,
  onMutationSuccess,
}: UseReservationActionsProps): UseReservationActionsReturn {
  const { toast } = useToast();
  const { run, isPending: isMutating } = useAsyncAction({
    throwError: true,
  });

  const decide = useCallback(
    async (
      kind: ReservationDecisionKind,
      reservation: Reservation,
      text: string
    ): Promise<ReservationDecisionAttempt> => {
      try {
        return await run(async () => {
          const result = await executeReservationDecision({
            kind,
            reservation,
            myUserId,
            myRole,
            text,
          });

          if (!result.ok) {
            toast({ variant: 'destructive', description: result.message });
            return result;
          }

          toast({ ...result.notice });
          try {
            await onMutationSuccess?.(reservation.id);
          } catch (callbackError) {
            // The write itself succeeded and was already confirmed to the
            // user; a failing follow-up refresh must not flip that result.
            console.error(
              '[useReservationActions] onMutationSuccess failed:',
              callbackError instanceof Error ? callbackError.name : 'unknown'
            );
          }
          return result;
        });
      } catch (error) {
        if (error instanceof ConcurrentActionError) {
          return { ok: false, reason: 'in_flight' };
        }
        throw error;
      }
    },
    [run, myUserId, myRole, toast, onMutationSuccess]
  );

  const accept = useCallback(
    (reservation: Reservation, message: string) =>
      decide('accept', reservation, message),
    [decide]
  );

  const rejectOrCancel = useCallback(
    (reservation: Reservation, text: string, action: 'reject' | 'cancel') =>
      decide(action, reservation, text),
    [decide]
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
