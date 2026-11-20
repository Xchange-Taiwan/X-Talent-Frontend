import { useCallback, useRef, useState } from 'react';

export interface RunAuthPendingOptions<T> {
  /**
   * When returning `true` (e.g. a route redirect was initiated), both
   * `isPending` and the synchronous `inFlightRef` lock stay `true` so neither
   * UI buttons nor programmatic double-invocations can re-fire during route
   * transition.
   */
  keepPendingWhen?: (result: T) => boolean;
}

/**
 * Shared pending-state and synchronous re-entrancy lock for user-triggered
 * `src/hooks/auth/*` actions.
 */
export function useAuthPendingAction() {
  const [isPending, setIsPending] = useState(false);
  const inFlightRef = useRef(false);

  const isInFlight = useCallback(() => inFlightRef.current, []);

  const runPending = useCallback(
    async <T>(
      action: () => Promise<T>,
      options?: RunAuthPendingOptions<T>
    ): Promise<T | undefined> => {
      if (inFlightRef.current) return undefined;
      inFlightRef.current = true;
      setIsPending(true);
      let keepPending = false;
      try {
        const result = await action();
        keepPending = Boolean(options?.keepPendingWhen?.(result));
        return result;
      } finally {
        if (!keepPending) {
          inFlightRef.current = false;
          setIsPending(false);
        }
      }
    },
    []
  );

  return { isPending, isInFlight, runPending };
}
