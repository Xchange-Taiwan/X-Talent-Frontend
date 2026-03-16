'use client';

import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';

import ErrorBoundary from '@/components/ErrorBoundary';
import GlobalErrorMonitor from '@/components/GlobalErrorMonitor';
import PageViewTracker from '@/components/PageViewTracker';
import WebVitalsMonitor from '@/components/WebVitalsMonitor';

export default function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  return (
    <SessionProvider session={session}>
      <GlobalErrorMonitor />
      <WebVitalsMonitor />
      <PageViewTracker />
      <ErrorBoundary>{children}</ErrorBoundary>
    </SessionProvider>
  );
}
