'use client';

import { SessionProvider } from 'next-auth/react';

import ErrorBoundary from '@/components/ErrorBoundary';
import GlobalErrorMonitor from '@/components/GlobalErrorMonitor';
import PageViewTracker from '@/components/PageViewTracker';
import WebVitalsMonitor from '@/components/WebVitalsMonitor';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <GlobalErrorMonitor />
      <WebVitalsMonitor />
      <PageViewTracker />
      <ErrorBoundary>{children}</ErrorBoundary>
    </SessionProvider>
  );
}
