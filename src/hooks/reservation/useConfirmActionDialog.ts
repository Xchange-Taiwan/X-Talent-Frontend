'use client';

import { useState } from 'react';

import { useToast } from '@/components/ui/use-toast';

interface UseConfirmActionDialogOptions {
  /** Static message, or a function of the caught error (e.g. to special-case
   * a specific error type with a more precise message). */
  errorMessage: string | ((error: unknown) => string);
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
        description:
          typeof errorMessage === 'function'
            ? errorMessage(error)
            : errorMessage,
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
