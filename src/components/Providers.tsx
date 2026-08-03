'use client';

import { SessionProvider } from 'next-auth/react';

import ErrorBoundary from '@/components/ErrorBoundary';
import GlobalErrorMonitor from '@/components/GlobalErrorMonitor';
import PageViewTracker from '@/components/PageViewTracker';
import SessionErrorWatcher from '@/components/SessionErrorWatcher';
import WebVitalsReporter from '@/components/WebVitalsReporter';
import { SessionHintProvider } from '@/hooks/user/auth/SessionHintContext';
import type { SessionHint } from '@/lib/auth/sessionHint';

export default function Providers({
  children,
  initialSessionHint,
}: {
  children: React.ReactNode;
  initialSessionHint: SessionHint | null;
}) {
  return (
    <SessionProvider>
      <SessionHintProvider value={initialSessionHint}>
        <GlobalErrorMonitor />
        <PageViewTracker />
        <WebVitalsReporter />
        <SessionErrorWatcher />
        <ErrorBoundary>{children}</ErrorBoundary>
      </SessionHintProvider>
    </SessionProvider>
  );
}
