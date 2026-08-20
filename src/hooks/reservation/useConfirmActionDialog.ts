'use client';

import { useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { getReservationErrorMessage } from '@/services/reservations';

interface UseConfirmActionDialogOptions {
  /** Fallback message shown for any error other than a reservation version
   * conflict (409), which always gets the shared conflict-specific message
   * via getReservationErrorMessage — kept here, not in each dialog, so
   * every reservation confirm dialog resolves it the same way. */
  errorMessage: string;
  onOpen?: () => void;
}

export function useConfirmActionDialog({
  errorMessage,
  onOpen,
}: UseConfirmActionDialogOptions) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const onOpenChange = (next: boolean) => {
    if (isSubmitting) return;
    setOpen(next);
    if (next) {
      onOpen?.();
    }
  };

  const execute = async (action: () => Promise<void> | void) => {
    setIsSubmitting(true);
    try {
      await action();
      setIsSubmitting(false);
      setOpen(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        description: getReservationErrorMessage(error, errorMessage),
      });
      setIsSubmitting(false);
    }
  };

  return {
    open,
    setOpen,
    isSubmitting,
    onOpenChange,
    execute,
  };
}
