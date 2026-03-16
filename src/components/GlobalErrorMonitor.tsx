'use client';

/**
 * GlobalErrorMonitor
 *
 * Client component that registers global error listeners for:
 *  - window.onerror         → runtime_error.unhandled_js
 *  - unhandledrejection     → runtime_error.unhandled_rejection
 *
 * Renders nothing. Listeners are removed on unmount to prevent leaks.
 * Only active in production (captureError no-ops in other environments).
 */

import { useEffect } from 'react';

import { buildBaseEvent, captureError } from '@/lib/monitoring';

export default function GlobalErrorMonitor() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      captureError(
        buildBaseEvent(
          'runtime_error.unhandled_js',
          event.error ?? event.message
        )
      );
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      captureError(
        buildBaseEvent('runtime_error.unhandled_rejection', event.reason)
      );
    }

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener(
        'unhandledrejection',
        handleUnhandledRejection
      );
    };
  }, []);

  return null;
}
