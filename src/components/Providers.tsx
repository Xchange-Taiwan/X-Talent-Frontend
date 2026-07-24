'use client';

import { SessionProvider } from 'next-auth/react';

import ErrorBoundary from '@/components/ErrorBoundary';
import GlobalErrorMonitor from '@/components/GlobalErrorMonitor';
import PageViewTracker from '@/components/PageViewTracker';
import SessionErrorWatcher from '@/components/SessionErrorWatcher';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <GlobalErrorMonitor />
      <PageViewTracker />
      <SessionErrorWatcher />
      <ErrorBoundary>{children}</ErrorBoundary>
    </SessionProvider>
  );
}
