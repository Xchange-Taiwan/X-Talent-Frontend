'use client';

import { SessionProvider } from 'next-auth/react';

import ErrorBoundary from '@/components/ErrorBoundary';
import GlobalErrorMonitor from '@/components/GlobalErrorMonitor';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <GlobalErrorMonitor />
      <ErrorBoundary>{children}</ErrorBoundary>
    </SessionProvider>
  );
}
