'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

import { DefaultErrorFallback } from '@/components/ErrorBoundary';
import { tryRecoverFromChunkLoadError } from '@/lib/chunkErrorRecovery';

export default function AppRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (tryRecoverFromChunkLoadError(error)) {
      return;
    }
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4">
      <DefaultErrorFallback onRetry={reset} />
    </main>
  );
}
