import { useCallback, useState } from 'react';

import { Reservation } from '@/components/reservation/types';
import { useToast } from '@/components/ui/use-toast';
import { ListKey } from '@/hooks/user/reservation/useReservationData';
import { trackEvent } from '@/lib/analytics';
import {
  acceptReservation,
  rejectOrCancelReservation,
  resolveOtherId,
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
  items: Reservation[];
  myUserId: string | undefined;
  variant: Variant;
  onMutationSuccess?: (id: string, affectedTabs: ListKey[]) => void;
}

interface UseReservationActionsReturn {
  accept: (payload: { id: string; message: string }) => Promise<void>;
  rejectOrCancel: (
    id: string,
    text: string,
    successMessage: string
  ) => Promise<void>;
  buildProfileHref: (it: Reservation) => string | undefined;
  isMutating: boolean;
}

export function useReservationActions({
  items,
  myUserId,
  variant,
  onMutationSuccess,
}: UseReservationActionsProps): UseReservationActionsReturn {
  const { toast } = useToast();
  const [isMutating, setIsMutating] = useState(false);

  const findItem = useCallback(
    (id: string): Reservation => {
      const found = items.find((x) => x.id === id);
      if (!found) {
        throw new Error(`[ReservationList] item not found for id=${id}`);
      }
      return found;
    },
    [items]
  );

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
    async ({ id, message }: { id: string; message: string }) => {
      await executeMutation(async () => {
        if (!myUserId) {
          throw new Error('[useReservationActions] missing current user id');
        }
        const it = findItem(id);
        await acceptReservation({
          message,
          reservation: it,
          myUserId,
        });
        toast({
          title: '已接受預約',
          description: '會議連結將於數分鐘內寄至雙方信箱',
        });
        onMutationSuccess?.(id, ACCEPT_AFFECTED_TABS);
      });
    },
    [executeMutation, findItem, myUserId, toast, onMutationSuccess]
  );

  const rejectOrCancel = useCallback(
    async (id: string, text: string, successMessage: string) => {
      await executeMutation(async () => {
        if (!myUserId) {
          throw new Error('[useReservationActions] missing current user id');
        }
        const it = findItem(id);
        await rejectOrCancelReservation({
          text,
          reservation: it,
          myUserId,
        });
        trackEvent({ name: 'reservation_rejected', feature: 'reservation' });
        toast({ description: successMessage });
        onMutationSuccess?.(id, buildRejectOrCancelAffectedTabs(variant));
      });
    },
    [executeMutation, findItem, myUserId, variant, toast, onMutationSuccess]
  );

  const buildProfileHref = useCallback(
    (it: Reservation): string | undefined => {
      if (!myUserId) return undefined;
      const otherId = resolveOtherId(it, myUserId);
      if (!otherId || String(otherId) === myUserId) return undefined;
      return `/profile/${otherId}`;
    },
    [myUserId]
  );

  return {
    accept,
    rejectOrCancel,
    buildProfileHref,
    isMutating,
  };
}
