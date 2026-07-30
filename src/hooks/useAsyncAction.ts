import { useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { captureFlowFailure } from '@/lib/monitoring';

export interface AsyncActionOptions<T> {
  captureFailure?: {
    flow: string;
    step: string;
    level?: 'info' | 'warning' | 'error';
    message?: string | ((error: unknown) => string);
  };
  toastOnError?: {
    title?: string;
    description: string | ((error: unknown) => string);
    variant?: 'default' | 'destructive';
    duration?: number;
  };
  onError?: (error: unknown) => void;
  onSuccess?: (data: T) => void;
  rethrow?: boolean;
}

export default function useAsyncAction() {
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();

  const run = async <T>(
    fn: () => Promise<T>,
    options?: AsyncActionOptions<T>
  ): Promise<T | undefined> => {
    setIsPending(true);
    try {
      const result = await fn();
      options?.onSuccess?.(result);
      return result;
    } catch (error) {
      if (options?.captureFailure) {
        const flow = options.captureFailure.flow;
        const step = options.captureFailure.step;
        const level = options.captureFailure.level;
        const msg =
          typeof options.captureFailure.message === 'function'
            ? options.captureFailure.message(error)
            : options.captureFailure.message ||
              (error instanceof Error ? error.message : 'Unexpected error');

        captureFlowFailure({
          flow,
          step,
          message: msg,
          level,
        });
      }

      if (options?.toastOnError) {
        const description =
          typeof options.toastOnError.description === 'function'
            ? options.toastOnError.description(error)
            : options.toastOnError.description;

        toast({
          variant: options.toastOnError.variant || 'destructive',
          title: options.toastOnError.title,
          description,
          duration: options.toastOnError.duration,
        });
      }

      options?.onError?.(error);

      if (options?.rethrow) {
        throw error;
      }
      return undefined;
    } finally {
      setIsPending(false);
    }
  };

  return { run, isPending };
}
