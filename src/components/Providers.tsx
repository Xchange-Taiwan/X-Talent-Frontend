'use client';

import { getSession, SessionProvider, signOut } from 'next-auth/react';

import AnalyticsUserSync from '@/components/AnalyticsUserSync';
import ErrorBoundary, {
  DefaultErrorFallback,
} from '@/components/ErrorBoundary';
import PageViewTracker from '@/components/PageViewTracker';
import PendingFeedbackQueueLauncher from '@/components/reservation/PendingFeedbackQueueLauncher';
import SentryUserSync from '@/components/SentryUserSync';
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
      <AnalyticsUserSync />
      <SentryUserSync />
      <PageViewTracker />
      <WebVitalsReporter />
      <SessionErrorWatcher />
      {isFeedbackEnabled() && <PendingFeedbackQueueLauncher />}
      <ErrorBoundary fallback={<DefaultErrorFallback />}>
        {children}
      </ErrorBoundary>
    </SessionProvider>
  );
}

export default NextAuthProvider;
