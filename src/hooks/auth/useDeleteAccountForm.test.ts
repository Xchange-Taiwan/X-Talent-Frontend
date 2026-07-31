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

vi.mock('@/app/profile/[pageUserId]/actions', () => ({
  revalidateProfilePath: vi.fn(),
}));

vi.mock('@/services/auth/deleteAccount', () => ({
  deleteAccount: vi.fn(),
}));

vi.mock('@/services/auth/googleAuthorize', () => ({
  getGoogleAuthorizeLoginUrl: vi.fn(),
}));

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
  sanitize: (val: string) => val,
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

import { revalidateProfilePath } from '@/app/profile/[pageUserId]/actions';
import { trackEvent } from '@/lib/analytics';
import { captureFlowFailure } from '@/lib/monitoring';
import { deleteAccount } from '@/services/auth/deleteAccount';
import { getGoogleAuthorizeLoginUrl } from '@/services/auth/googleAuthorize';
import { mockRouter } from '@/test/mocks/navigation';
import {
  mockSession,
  mockSignOut,
  mockUseSession,
} from '@/test/mocks/nextAuth';
import { mockToast } from '@/test/mocks/useToast';

import useDeleteAccountForm from './useDeleteAccountForm';

const mockDeleteAccount = vi.mocked(deleteAccount);
const mockGetGoogleAuthorizeLoginUrl = vi.mocked(getGoogleAuthorizeLoginUrl);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);
const mockTrackEvent = vi.mocked(trackEvent);
const mockRevalidateProfilePath = vi.mocked(revalidateProfilePath);

describe('useDeleteAccountForm', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, NEXT_PUBLIC_CAN_DELETE_ACCOUNT: 'true' };
    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: vi.fn(),
    });

    // Mock sessionStorage
    const store: Record<string, string> = {};
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('detects correct mode as xc when session provider is not custom-google-token', () => {
    const { result } = renderHook(() => useDeleteAccountForm());
    expect(result.current.mode).toBe('xc');
  });

  it('detects correct mode as google when session provider is custom-google-token', () => {
    mockUseSession.mockReturnValue({
      data: {
        ...mockSession,
        user: { ...mockSession.user, provider: 'custom-google-token' },
      },
      status: 'authenticated',
      update: vi.fn(),
    });

    const { result } = renderHook(() => useDeleteAccountForm());
    expect(result.current.mode).toBe('google');
  });

  it('onSubmitXC checks environment flag and toast if false', async () => {
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
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it('onSubmitXC success flow', async () => {
    mockDeleteAccount.mockResolvedValueOnce({
      status: 'success',
    });

    const { result } = renderHook(() => useDeleteAccountForm());

    await act(async () => {
      await result.current.onSubmitXC({
        email: 'test@example.com',
        password: 'Password1!',
      });
    });

    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: 'delete_account_succeeded',
      feature: 'auth',
    });
    expect(mockRevalidateProfilePath).toHaveBeenCalledWith('test-user-id');
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/' });
  });

  it('onSubmitXC blocked_reservations flow', async () => {
    mockDeleteAccount.mockResolvedValueOnce({
      status: 'blocked_reservations',
    });

    const { result } = renderHook(() => useDeleteAccountForm());

    expect(result.current.blockedByReservations).toBe(false);

    await act(async () => {
      await result.current.onSubmitXC({
        email: 'test@example.com',
        password: 'Password1!',
      });
    });

    expect(result.current.blockedByReservations).toBe(true);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('onSubmitXC error flow (non-success and non-blocked)', async () => {
    mockDeleteAccount.mockResolvedValueOnce({
      status: 'error',
      message: 'invalid password',
    });

    const { result } = renderHook(() => useDeleteAccountForm());

    await act(async () => {
      await result.current.onSubmitXC({
        email: 'test@example.com',
        password: 'Password1!',
      });
    });

    expect(mockCaptureFlowFailure).toHaveBeenCalledWith({
      flow: 'delete_account',
      step: 'submit',
      message: 'invalid password',
      level: 'info',
    });
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      description: 'invalid password',
      duration: 3000,
    });
  });

  it('initiateGoogleReauth checks environment flag and toast if false', async () => {
    process.env.NEXT_PUBLIC_CAN_DELETE_ACCOUNT = 'false';

    const { result } = renderHook(() => useDeleteAccountForm());

    await act(async () => {
      await result.current.initiateGoogleReauth();
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      description: '此環境不支援帳號刪除',
      duration: 3000,
    });
    expect(mockGetGoogleAuthorizeLoginUrl).not.toHaveBeenCalled();
  });

  it('initiateGoogleReauth success flow', async () => {
    mockGetGoogleAuthorizeLoginUrl.mockResolvedValueOnce({
      authorization_url: 'https://google-auth-url.com',
      state: 'mock-state',
    });

    const { result } = renderHook(() => useDeleteAccountForm());

    await act(async () => {
      await result.current.initiateGoogleReauth();
    });

    expect(sessionStorage.getItem('delete_account_email')).toBe(
      'test@example.com'
    );
    expect(mockRouter.push).toHaveBeenCalledWith('https://google-auth-url.com');
  });

  it('initiateGoogleReauth failure flow', async () => {
    mockGetGoogleAuthorizeLoginUrl.mockRejectedValueOnce(
      new Error('API failed')
    );

    const { result } = renderHook(() => useDeleteAccountForm());

    await act(async () => {
      await result.current.initiateGoogleReauth();
    });

    expect(sessionStorage.getItem('delete_account_email')).toBeNull();
    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      description: '無法取得 Google 授權連結，請稍後再試',
      duration: 3000,
    });
  });
});
