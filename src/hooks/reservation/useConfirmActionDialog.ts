'use client';

import { useState } from 'react';

import { useToast } from '@/components/ui/use-toast';

interface UseConfirmActionDialogOptions {
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
        description: errorMessage,
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
