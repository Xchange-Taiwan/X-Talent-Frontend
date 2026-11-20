import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

vi.mock('@/actions/auth', () => ({
  revalidateProfilePathAfterDelete: vi.fn(),
}));

import { revalidateProfilePathAfterDelete } from '@/actions/auth';
import {
  authLifecycle,
  createAuthLifecycle,
  createInMemorySessionStorage,
  PENDING_DELETE_ACCOUNT_EMAIL_KEY,
} from '@/lib/auth/sessionLifecycle';
import { mockRouter } from '@/test/mocks/navigation';
import {
  mockSession,
  mockSignOut,
  mockUseSession,
} from '@/test/mocks/nextAuth';
import { mockToast } from '@/test/mocks/useToast';

import useDeleteAccountForm from './useDeleteAccountForm';

const mockRevalidateProfilePathAfterDelete = vi.mocked(
  revalidateProfilePathAfterDelete
);

describe('useDeleteAccountForm (#940)', () => {
  const originalEnv = process.env;
  const deleteAccountFn = vi.fn();
  const getGoogleAuthorizeUrl = vi.fn();
  let storage = createInMemorySessionStorage();

  beforeEach(() => {
    vi.clearAllMocks();
    storage = createInMemorySessionStorage();
    mockRevalidateProfilePathAfterDelete.mockResolvedValue(undefined);
    process.env = { ...originalEnv, NEXT_PUBLIC_CAN_DELETE_ACCOUNT: 'true' };
    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: vi.fn(),
    });

    const scoped = createAuthLifecycle({
      authClient: {
        deleteAccount: deleteAccountFn,
        getGoogleAuthorizeUrl,
      },
      storage,
      clearAnalyticsUser: vi.fn(),
      captureFailure: vi.fn(),
    });
    vi.spyOn(authLifecycle, 'deleteAccountXC').mockImplementation(
      (credentials, overrides) => scoped.deleteAccountXC(credentials, overrides)
    );
    vi.spyOn(
      authLifecycle,
      'startDeleteAccountGoogleReauth'
    ).mockImplementation((email, overrides) =>
      scoped.startDeleteAccountGoogleReauth(email, overrides)
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('detects xc vs google mode from session provider', () => {
    const { result, unmount } = renderHook(() => useDeleteAccountForm());
    expect(result.current.mode).toBe('xc');
    unmount();

    mockUseSession.mockReturnValue({
      data: {
        ...mockSession,
        user: { ...mockSession.user, provider: 'custom-google-token' },
      },
      status: 'authenticated',
      update: vi.fn(),
    });
    const googleHook = renderHook(() => useDeleteAccountForm());
    expect(googleHook.result.current.mode).toBe('google');
  });

  it('preserves isAccountDeletionEnabled(), blocked_reservations state, error reset, and success teardown on onSubmitXC', async () => {
    process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = 'false';
    const { result } = renderHook(() => useDeleteAccountForm());

    await act(async () => {
      await result.current.onSubmitXC({
        email: 'test@example.com',
        password: 'Password1!',
      });
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      description: '此環境不支援帳號刪除',
      duration: 3000,
    });
    expect(deleteAccountFn).not.toHaveBeenCalled();

    // blocked_reservations branch sets blockedByReservations=true without toast or signOut
    mockToast.mockClear();
    process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = ' TRUE ';
    deleteAccountFn.mockResolvedValueOnce({ status: 'blocked_reservations' });

    await act(async () => {
      await result.current.onSubmitXC({
        email: 'test@example.com',
        password: 'Password1!',
      });
    });

    expect(result.current.blockedByReservations).toBe(true);
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();

    // Retry resulting in error clears blockedByReservations and shows error toast
    deleteAccountFn.mockResolvedValueOnce({
      status: 'error',
      message: 'invalid password',
    });
    await act(async () => {
      await result.current.onSubmitXC({
        email: 'test@example.com',
        password: 'Password1!',
      });
    });
    expect(result.current.blockedByReservations).toBe(false);
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      description: 'invalid password',
      duration: 3000,
    });

    // Success executes revalidateAfterDelete before signOut({ callbackUrl: '/' })
    deleteAccountFn.mockResolvedValueOnce({ status: 'success' });
    await act(async () => {
      await result.current.onSubmitXC({
        email: 'test@example.com',
        password: 'Password1!',
      });
    });
    expect(mockRevalidateProfilePathAfterDelete).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/' });
    expect(result.current.isSubmitting).toBe(false);
  });

  it('delegates initiateGoogleReauth with feature-flag guard, failure reset, and pending retention on redirect', async () => {
    process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = 'false';
    const { result } = renderHook(() => useDeleteAccountForm());

    await act(async () => {
      await result.current.initiateGoogleReauth();
    });
    expect(getGoogleAuthorizeUrl).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);

    process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = ' TRUE ';
    getGoogleAuthorizeUrl.mockRejectedValueOnce(new Error('OAuth down'));
    await act(async () => {
      await result.current.initiateGoogleReauth();
    });
    expect(storage.getItem(PENDING_DELETE_ACCOUNT_EMAIL_KEY)).toBeNull();
    expect(result.current.isSubmitting).toBe(false);

    getGoogleAuthorizeUrl.mockResolvedValueOnce({
      authorization_url: 'https://google-auth-url.com',
      state: 'mock-state',
    });
    await act(async () => {
      await result.current.initiateGoogleReauth();
    });
    expect(storage.getItem(PENDING_DELETE_ACCOUNT_EMAIL_KEY)).toBe(
      'test@example.com'
    );
    expect(mockRouter.push).toHaveBeenCalledWith('https://google-auth-url.com');
    expect(result.current.isSubmitting).toBe(true);
  });
});
