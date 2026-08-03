import { useCallback } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { ListKey } from '@/hooks/user/reservation/useReservationData';
import { trackEvent } from '@/lib/analytics';
import {
  acceptReservation,
  rejectOrCancelReservation,
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
  onMutationSuccess?: (id: string, affectedTabs: ListKey[]) => void;
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
  onMutationSuccess,
}: UseReservationActionsProps): UseReservationActionsReturn {
  const { toast } = useToast();
  const { run, isPending: isMutating } = useAsyncAction({
    errorTitle: '錯誤',
    errorMessage: '操作失敗，請稍後再試。',
    throwError: true,
  });

  const accept = useCallback(
    async (reservation: Reservation, message: string) => {
      await run(async () => {
        await acceptReservation({
          message,
          reservation,
          myUserId,
        });
        toast({
          title: '已接受預約',
          description: '會議連結將於數分鐘內寄至雙方信箱',
        });
        onMutationSuccess?.(reservation.id, ACCEPT_AFFECTED_TABS);
      });
    },
    [run, myUserId, toast, onMutationSuccess]
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
        });
        trackEvent({ name: 'reservation_rejected', feature: 'reservation' });
        const successMessage =
          action === 'reject' ? '已拒絕預約' : '已取消預約';
        toast({ description: successMessage });
        onMutationSuccess?.(
          reservation.id,
          buildRejectOrCancelAffectedTabs(variant)
        );
      });
    },
    [run, myUserId, variant, toast, onMutationSuccess]
  );

  return {
    accept,
    rejectOrCancel,
    isMutating,
  };
}
