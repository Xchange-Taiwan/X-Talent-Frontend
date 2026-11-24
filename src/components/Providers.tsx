'use client';

import { getSession, SessionProvider, signOut } from 'next-auth/react';

import ErrorBoundary from '@/components/ErrorBoundary';
import PageViewTracker from '@/components/PageViewTracker';
import PendingFeedbackQueueLauncher from '@/components/reservation/PendingFeedbackQueueLauncher';
import SessionErrorWatcher from '@/components/SessionErrorWatcher';
import WebVitalsReporter from '@/components/WebVitalsReporter';
import { setOnRefreshTokenError, setSessionGetter } from '@/lib/apiClient';
import { terminateClientSession } from '@/lib/auth/sessionLifecycle';
import { isFeedbackEnabled } from '@/lib/featureFlags';

setSessionGetter(getSession);
setOnRefreshTokenError(() =>
  terminateClientSession('refresh_token_error', { signOut })
);

export function NextAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {/* Single telemetry adapter: GA4 / Clarity / Sentry identity + page_view (#979) */}
      <PageViewTracker />
      <WebVitalsReporter />
      <SessionErrorWatcher />
      {isFeedbackEnabled() && <PendingFeedbackQueueLauncher />}
      <ErrorBoundary componentName="RootAppShell">{children}</ErrorBoundary>
    </SessionProvider>
  );
}

export default NextAuthProvider;
