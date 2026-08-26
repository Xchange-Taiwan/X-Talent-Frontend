'use client';

import { useCallback } from 'react';

import { useAsyncAction } from '@/hooks/useAsyncAction';
import { getReservationErrorMessage } from '@/services/reservations';

/**
 * Wraps QuickReplyDialog's accept action with the shared error-toast
 * behavior, via the generic `useAsyncAction` rather than
 * `useConfirmActionDialog` - this dialog's open state is already owned by
 * its `open` prop, so a hook whose contract centers on owning open/onOpenChange
 * would be a mismatched fit here.
 */
export function useQuickReplyAccept() {
  const { run, isPending } = useAsyncAction({
    throwError: false,
    toastOnError: {
      description: (error) =>
        getReservationErrorMessage(error, '接受預約失敗,請稍後再試'),
    },
  });

  const execute = useCallback(
    (action: () => Promise<void>) => run(action),
    [run]
  );

  return { isSubmitting: isPending, execute };
}
