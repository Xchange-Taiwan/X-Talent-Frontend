import { useCallback, useState } from 'react';

import { Reservation } from '@/components/reservation/types';
import { useToast } from '@/components/ui/use-toast';
import { ListKey } from '@/hooks/user/reservation/useReservationData';
import { trackEvent } from '@/lib/analytics';
import {
  acceptReservation,
  rejectOrCancelReservation,
} from '@/services/reservations';

export type Variant =
  | 'upcoming'
  | 'pending-mentee'
  | 'pending-mentor'
  | 'history';

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
    successMessage: string
  ) => Promise<void>;
  isMutating: boolean;
}

export function useReservationActions({
  myUserId,
  variant,
  onMutationSuccess,
}: UseReservationActionsProps): UseReservationActionsReturn {
  const { toast } = useToast();
  const [isMutating, setIsMutating] = useState(false);

  /**
   * Internal async wrapper to centralize lifecycle management and error handling
   */
  const executeMutation = useCallback(
    async (action: () => Promise<void>) => {
      setIsMutating(true);
      try {
        await action();
      } catch (err) {
        toast({
          variant: 'destructive',
          title: '錯誤',
          description: '操作失敗，請稍後再試。',
        });
        throw err;
      } finally {
        setIsMutating(false);
      }
    },
    [toast]
  );

  const accept = useCallback(
    async (reservation: Reservation, message: string) => {
      await executeMutation(async () => {
        if (!myUserId) {
          throw new Error('[useReservationActions] missing current user id');
        }
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
    [executeMutation, myUserId, toast, onMutationSuccess]
  );

  const rejectOrCancel = useCallback(
    async (reservation: Reservation, text: string, successMessage: string) => {
      await executeMutation(async () => {
        if (!myUserId) {
          throw new Error('[useReservationActions] missing current user id');
        }
        await rejectOrCancelReservation({
          text,
          reservation,
          myUserId,
        });
        trackEvent({ name: 'reservation_rejected', feature: 'reservation' });
        toast({ description: successMessage });
        onMutationSuccess?.(
          reservation.id,
          buildRejectOrCancelAffectedTabs(variant)
        );
      });
    },
    [executeMutation, myUserId, variant, toast, onMutationSuccess]
  );

  return {
    accept,
    rejectOrCancel,
    isMutating,
  };
}
