import { useCallback, useState } from 'react';

import { Reservation } from '@/components/reservation/types';
import { useToast } from '@/components/ui/use-toast';
import { ListKey } from '@/hooks/user/reservation/useReservationData';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  ACCEPT_AFFECTED_TABS,
  acceptReservation,
  rejectOrCancelReservation,
  Variant,
} from '@/services/reservations';

interface UseReservationActionsProps {
  items: Reservation[];
  myUserId: string;
  variant: Variant;
  onMutationSuccess?: (id: string, affectedTabs: ListKey[]) => void;
}

export function useReservationActions({
  items,
  myUserId,
  variant,
  onMutationSuccess,
}: UseReservationActionsProps) {
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

  const accept = useCallback(
    async ({ id, message }: { id: string; message: string }) => {
      setIsMutating(true);
      try {
        const it = findItem(id);
        await acceptReservation({
          id,
          message,
          reservation: it,
          myUserId,
        });
        toast({
          title: '已接受預約',
          description: '會議連結將於數分鐘內寄至雙方信箱',
        });
        onMutationSuccess?.(id, ACCEPT_AFFECTED_TABS);
      } catch (err) {
        captureFlowFailure({
          flow: 'reservation_accept',
          step: 'component_handler',
          message:
            err instanceof Error
              ? err.message
              : 'Component accept handler failed',
        });
        toast({
          variant: 'destructive',
          title: '錯誤',
          description: '操作失敗，請稍後再試。',
        });
      } finally {
        setIsMutating(false);
      }
    },
    [findItem, myUserId, toast, onMutationSuccess]
  );

  const rejectOrCancel = useCallback(
    async (id: string, text: string, successMessage: string) => {
      setIsMutating(true);
      try {
        const it = findItem(id);
        const { affectedTabs } = await rejectOrCancelReservation({
          id,
          text,
          reservation: it,
          myUserId,
          variant,
        });
        toast({ description: successMessage });
        onMutationSuccess?.(id, affectedTabs);
      } catch (err) {
        captureFlowFailure({
          flow: 'reservation_reject',
          step: 'component_handler',
          message:
            err instanceof Error
              ? err.message
              : 'Component reject/cancel handler failed',
        });
        toast({
          variant: 'destructive',
          title: '錯誤',
          description: '操作失敗，請稍後再試。',
        });
      } finally {
        setIsMutating(false);
      }
    },
    [findItem, myUserId, variant, toast, onMutationSuccess]
  );

  return {
    accept,
    rejectOrCancel,
    isMutating,
  };
}
