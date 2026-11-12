import { render } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { type SessionContextValue, signOut, useSession } from 'next-auth/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAnalyticsUser } from '@/lib/analytics';

import SessionErrorWatcher from './SessionErrorWatcher';

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    clearAnalyticsUser: vi.fn(),
  };
});

const mockUseSession = vi.mocked(useSession);
const mockSignOut = vi.mocked(signOut);
const mockClearAnalyticsUser = vi.mocked(clearAnalyticsUser);

describe('SessionErrorWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not clear analytics user or sign out when session has no RefreshTokenError', () => {
    mockUseSession.mockReturnValue(
      fromPartial<SessionContextValue>({
        data: {
          user: {
            id: '999998',
            isMentor: true,
          },
        },
        status: 'authenticated',
      })
    );

    const { rerender } = render(<SessionErrorWatcher />);

    expect(mockClearAnalyticsUser).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();

    mockUseSession.mockReturnValue(
      fromPartial<SessionContextValue>({
        data: null,
        status: 'unauthenticated',
      })
    );

    rerender(<SessionErrorWatcher />);

    expect(mockClearAnalyticsUser).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('clears analytics user before calling signOut when session has RefreshTokenError (#866)', () => {
    mockUseSession.mockReturnValue(
      fromPartial<SessionContextValue>({
        data: {
          error: 'RefreshTokenError',
          user: {
            id: '999998',
            isMentor: true,
          },
        },
        status: 'authenticated',
      })
    );

    render(<SessionErrorWatcher />);

    expect(mockClearAnalyticsUser).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/auth/signin' });

    const clearOrder = mockClearAnalyticsUser.mock.invocationCallOrder[0]!;
    const signOutOrder = mockSignOut.mock.invocationCallOrder[0]!;
    expect(clearOrder).toBeLessThan(signOutOrder);
  });
});
