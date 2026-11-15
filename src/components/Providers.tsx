'use client';

import { getSession, SessionProvider, signOut } from 'next-auth/react';

import AnalyticsUserSync from '@/components/AnalyticsUserSync';
import ErrorBoundary from '@/components/ErrorBoundary';
import GlobalErrorMonitor from '@/components/GlobalErrorMonitor';
import PageViewTracker from '@/components/PageViewTracker';
import PendingFeedbackQueueLauncher from '@/components/reservation/PendingFeedbackQueueLauncher';
import SessionErrorWatcher from '@/components/SessionErrorWatcher';
import WebVitalsReporter from '@/components/WebVitalsReporter';
import { setOnRefreshTokenError, setSessionGetter } from '@/lib/apiClient';
import { terminateClientSession } from '@/lib/auth/sessionLifecycle';

setSessionGetter(getSession);
setOnRefreshTokenError(() =>
  terminateClientSession('refresh_token_error', { signOut })
);

export function NextAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AnalyticsUserSync />
      <GlobalErrorMonitor />
      <PageViewTracker />
      <WebVitalsReporter />
      <SessionErrorWatcher />
      <PendingFeedbackQueueLauncher />
      <ErrorBoundary>{children}</ErrorBoundary>
    </SessionProvider>
  );
}

export default NextAuthProvider;
