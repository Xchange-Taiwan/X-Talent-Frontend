import { render } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { type SessionContextValue, signOut, useSession } from 'next-auth/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAnalyticsUser } from '@/lib/analytics';
import { PENDING_AUTH_CALLBACK_URL_KEY } from '@/lib/auth/authFlowStorage';
import {
  DOM_AUTH_STATE_ATTR,
  SESSION_HINT_COOKIE,
} from '@/lib/auth/sessionHint';
import { scheduleReadModel } from '@/lib/mentor-schedule/scheduleReadModel';
import { reservationReadModel } from '@/lib/reservation/reservationReadModel';
import { notificationStoreManager } from '@/stores/notificationStore';

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
    window.sessionStorage.clear();
    notificationStoreManager.clear();
    reservationReadModel.clear();
    scheduleReadModel.clear();
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

  it('atomically clears sessionHint, authFlowStorage, stores, and analytics user before calling signOut on RefreshTokenError (#866, #885)', () => {
    document.cookie = `${SESSION_HINT_COOKIE}=1||`;
    document.documentElement.setAttribute(DOM_AUTH_STATE_ATTR, 'mentor');
    window.sessionStorage.setItem(
      PENDING_AUTH_CALLBACK_URL_KEY,
      '/reservation/mentor'
    );
    notificationStoreManager.getOrCreateState('999998');
    notificationStoreManager.setInitialData('999998', 5, [], null);
    reservationReadModel.set(
      { userId: '999998', state: 'MENTOR_PENDING' },
      { items: [], next_dtend: 0 }
    );
    scheduleReadModel.set({ userId: '999998', year: 2026, month: 11 }, []);

    expect(
      notificationStoreManager.getOrCreateState('999998').unreadCountState
    ).toBe(5);

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

    expect(document.cookie).not.toContain(`${SESSION_HINT_COOKIE}=`);
    expect(
      document.documentElement.getAttribute(DOM_AUTH_STATE_ATTR)
    ).toBeNull();
    expect(
      window.sessionStorage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)
    ).toBeNull();
    expect(
      notificationStoreManager.getOrCreateState('999998').unreadCountState
    ).toBe(0);
    expect(
      reservationReadModel.get({
        userId: '999998',
        state: 'MENTOR_PENDING',
      })
    ).toBeUndefined();
    expect(
      scheduleReadModel.get({ userId: '999998', year: 2026, month: 11 })
    ).toBeUndefined();

    const clearOrder = mockClearAnalyticsUser.mock.invocationCallOrder[0]!;
    const signOutOrder = mockSignOut.mock.invocationCallOrder[0]!;
    expect(clearOrder).toBeLessThan(signOutOrder);
  });
});
