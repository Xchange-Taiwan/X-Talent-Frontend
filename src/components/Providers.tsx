'use client';

import { getSession, SessionProvider } from 'next-auth/react';

import AnalyticsUserSync from '@/components/AnalyticsUserSync';
import ErrorBoundary from '@/components/ErrorBoundary';
import GlobalErrorMonitor from '@/components/GlobalErrorMonitor';
import PageViewTracker from '@/components/PageViewTracker';
import { PendingFeedbackQueueLauncher } from '@/components/reservation/PendingFeedbackModal';
import SessionErrorWatcher from '@/components/SessionErrorWatcher';
import WebVitalsReporter from '@/components/WebVitalsReporter';
import { setSessionGetter } from '@/lib/apiClient';

setSessionGetter(getSession);
export default function Providers({ children }: { children: React.ReactNode }) {
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
