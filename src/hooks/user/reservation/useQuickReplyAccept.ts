'use client';

import { useCallback } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { getReservationErrorMessage } from '@/services/reservations';

/**
 * Wraps QuickReplyDialog's accept action with the shared error-toast
 * behavior, calling `getReservationErrorMessage` (service layer) from here
 * rather than the component so the component never imports src/services
 * directly.
 *
 * Intentionally has no pending/loading state of its own: `accept` (from
 * `useReservationActions`) already tracks its own in-flight state via
 * `isMutating`, which the caller already reads for disabling/spinners -
 * a second, separately-tracked `isSubmitting` here for the exact same
 * underlying call would just be duplicated state to keep in sync.
 */
export function useQuickReplyAccept() {
  const { toast } = useToast();

  const execute = useCallback(
    async (action: () => Promise<void>) => {
      try {
        await action();
      } catch (error) {
        toast({
          variant: 'destructive',
          description: getReservationErrorMessage(
            error,
            '接受預約失敗,請稍後再試'
          ),
        });
      }
    },
    [toast]
  );

  return { execute };
}
