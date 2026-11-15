import { render, screen } from '@testing-library/react';
import { getSession, signOut } from 'next-auth/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { setOnRefreshTokenError, setSessionGetter } from '@/lib/apiClient';
import { terminateClientSession } from '@/lib/auth/sessionLifecycle';

import { NextAuthProvider } from './Providers';

interface MockSessionProviderProps {
  children: React.ReactNode;
  refetchOnWindowFocus?: boolean;
}

vi.mock('next-auth/react', () => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
  SessionProvider: (props: MockSessionProviderProps) => (
    <div
      data-testid="session-provider"
      data-refetch-on-window-focus={String(props.refetchOnWindowFocus)}
    >
      {props.children}
    </div>
  ),
}));

vi.mock('@/components/AnalyticsUserSync', () => ({
  default: () => null,
}));
vi.mock('@/components/GlobalErrorMonitor', () => ({
  default: () => null,
}));
vi.mock('@/components/PageViewTracker', () => ({
  default: () => null,
}));
vi.mock('@/components/WebVitalsReporter', () => ({
  default: () => null,
}));
vi.mock('@/components/SessionErrorWatcher', () => ({
  default: () => <div data-testid="session-error-watcher" />,
}));
vi.mock('@/components/reservation/PendingFeedbackQueueLauncher', () => ({
  default: () => null,
}));

vi.mock('@/lib/apiClient', () => ({
  setSessionGetter: vi.fn(),
  setOnRefreshTokenError: vi.fn(),
}));

vi.mock('@/lib/auth/sessionLifecycle', () => ({
  terminateClientSession: vi.fn().mockResolvedValue(undefined),
}));

describe('NextAuthProvider', () => {
  it('wires apiClient session getter and RefreshTokenError teardown at initialization', async () => {
    expect(setSessionGetter).toHaveBeenCalledWith(getSession);
    expect(setOnRefreshTokenError).toHaveBeenCalledTimes(1);

    const handler = vi.mocked(setOnRefreshTokenError).mock.calls[0]?.[0];
    expect(handler).toBeTypeOf('function');

    await handler?.();

    const expectedAdapters = { signOut };
    expect(terminateClientSession).toHaveBeenCalledWith(
      'refresh_token_error',
      expectedAdapters
    );
  });

  it('mounts SessionProvider without disabling refetchOnWindowFocus so multi-tab session state stays in sync', () => {
    render(
      <NextAuthProvider>
        <span>app-child</span>
      </NextAuthProvider>
    );

    expect(screen.getByText('app-child')).toBeInTheDocument();
    expect(screen.getByTestId('session-error-watcher')).toBeInTheDocument();
    expect(screen.getByTestId('session-provider')).toHaveAttribute(
      'data-refetch-on-window-focus',
      'undefined'
    );
  });
});
