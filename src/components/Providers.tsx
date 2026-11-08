'use client';

import { getSession, SessionProvider } from 'next-auth/react';

import ErrorBoundary from '@/components/ErrorBoundary';
import GlobalErrorMonitor from '@/components/GlobalErrorMonitor';
import PageViewTracker from '@/components/PageViewTracker';
import SessionErrorWatcher from '@/components/SessionErrorWatcher';
import WebVitalsReporter from '@/components/WebVitalsReporter';
import { setSessionGetter } from '@/lib/apiClient';

setSessionGetter(getSession);
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <GlobalErrorMonitor />
      <PageViewTracker />
      <WebVitalsReporter />
      <SessionErrorWatcher />
      <ErrorBoundary>{children}</ErrorBoundary>
    </SessionProvider>
  );
}
