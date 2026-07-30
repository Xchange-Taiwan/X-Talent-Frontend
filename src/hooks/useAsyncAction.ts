import { useCallback, useState } from 'react';

import { useToast } from '@/components/ui/use-toast';
import { captureFlowFailure } from '@/lib/monitoring';

export interface AsyncActionOptions<T> {
  captureFailure?: {
    flow: string;
    step: string | ((error: unknown) => string);
    level?:
      | 'info'
      | 'warning'
      | 'error'
      | ((error: unknown) => 'info' | 'warning' | 'error' | undefined);
    message?: string | ((error: unknown) => string);
    errorCode?: string | ((error: unknown) => string | undefined);
  };
  toastOnError?: {
    title?: string;
    description: string | ((error: unknown) => string);
    variant?: 'default' | 'destructive';
    duration?: number | ((error: unknown) => number | undefined);
  };
  onError?: (error: unknown) => void;
  onSuccess?: (data: T) => void;
  rethrow?: boolean;
}

export default function useAsyncAction() {
  const [isPending, setIsPending] = useState(false);
  const { toast } = useToast();

  const run = useCallback(
    async <T>(
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
          const step =
            typeof options.captureFailure.step === 'function'
              ? options.captureFailure.step(error)
              : options.captureFailure.step;
          const level =
            typeof options.captureFailure.level === 'function'
              ? options.captureFailure.level(error)
              : options.captureFailure.level;
          const msg =
            typeof options.captureFailure.message === 'function'
              ? options.captureFailure.message(error)
              : options.captureFailure.message ||
                (error instanceof Error ? error.message : 'Unexpected error');
          const errorCode =
            typeof options.captureFailure.errorCode === 'function'
              ? options.captureFailure.errorCode(error)
              : options.captureFailure.errorCode;

          captureFlowFailure({
            flow,
            step,
            message: msg,
            level,
            errorCode,
          });
        }

        if (options?.toastOnError) {
          const description =
            typeof options.toastOnError.description === 'function'
              ? options.toastOnError.description(error)
              : options.toastOnError.description;

          const duration =
            typeof options.toastOnError.duration === 'function'
              ? options.toastOnError.duration(error)
              : options.toastOnError.duration;

          toast({
            variant: options.toastOnError.variant || 'destructive',
            title: options.toastOnError.title,
            description,
            duration,
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
    },
    [toast]
  );

  return { run, isPending };
}
