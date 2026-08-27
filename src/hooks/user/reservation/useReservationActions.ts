import { useCallback } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { ListKey } from '@/hooks/user/reservation/useReservationData';
import { trackEvent } from '@/lib/analytics';
import {
  acceptReservation,
  rejectOrCancelReservation,
  ReservationVersionConflictError,
} from '@/services/reservations';
import { Reservation } from '@/types/reservation';

export type Variant =
  'upcoming' | 'pending-mentee' | 'pending-mentor' | 'history';

export const ACCEPT_AFFECTED_TABS: ListKey[] = ['pending', 'upcoming'];

export const buildRejectOrCancelAffectedTabs = (
  variant: Variant
): ListKey[] => {
  const sourceTab: ListKey | null =
    variant === 'upcoming'
      ? 'upcoming'
      : variant === 'pending-mentor' || variant === 'pending-mentee'
        ? 'pending'
        : null;
  return sourceTab ? [sourceTab, 'history'] : [];
};

interface UseReservationActionsProps {
  myUserId: string | undefined;
  variant: Variant;
  /** Which side `myUserId` is acting as for these reservations - forwarded
   * to the mutation service so it knows which parties' cache slots to
   * invalidate after a successful write. */
  myRole: 'mentee' | 'mentor';
  onMutationSuccess?: (
    id: string,
    affectedTabs: ListKey[]
  ) => void | Promise<void>;
  /** Called once (no auto-retry of the action itself) when the backend
   * rejects the status update with a 409 version conflict, so the caller can
   * refetch the affected tabs and show the user fresh data. */
  onVersionConflict?: (affectedTabs: ListKey[]) => void;
}

interface UseReservationActionsReturn {
  accept: (reservation: Reservation, message: string) => Promise<void>;
  rejectOrCancel: (
    reservation: Reservation,
    text: string,
    action: 'reject' | 'cancel'
  ) => Promise<void>;
  isMutating: boolean;
}

export function useReservationActions({
  myUserId,
  variant,
  myRole,
  onMutationSuccess,
  onVersionConflict,
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
      try {
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
          await onMutationSuccess?.(reservation.id, ACCEPT_AFFECTED_TABS);
        });
      } catch (err) {
        if (err instanceof ReservationVersionConflictError) {
          onVersionConflict?.(ACCEPT_AFFECTED_TABS);
        }
        throw err;
      }
    },
    [run, myUserId, myRole, toast, onMutationSuccess, onVersionConflict]
  );

  const rejectOrCancel = useCallback(
    async (
      reservation: Reservation,
      text: string,
      action: 'reject' | 'cancel'
    ) => {
      try {
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
          await onMutationSuccess?.(
            reservation.id,
            buildRejectOrCancelAffectedTabs(variant)
          );
        });
      } catch (err) {
        if (err instanceof ReservationVersionConflictError) {
          onVersionConflict?.(buildRejectOrCancelAffectedTabs(variant));
        }
        throw err;
      }
    },
    [
      run,
      myUserId,
      myRole,
      variant,
      toast,
      onMutationSuccess,
      onVersionConflict,
    ]
  );

  return {
    accept,
    rejectOrCancel,
    isMutating,
  };
}
