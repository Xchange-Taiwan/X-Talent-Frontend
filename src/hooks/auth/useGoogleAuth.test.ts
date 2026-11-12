import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { navigationMockFactory } = await import('@/test/mocks/navigation');
  return navigationMockFactory();
});

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

vi.mock('@/services/auth/googleAuthorize', () => ({
  getGoogleAuthorizeLoginUrl: vi.fn(),
  getGoogleAuthorizeSignupUrl: vi.fn(),
}));

import { POST_LOGIN_CALLBACK_URL_KEY } from '@/lib/url/resolveSafeCallbackUrl';
import {
  getGoogleAuthorizeLoginUrl,
  getGoogleAuthorizeSignupUrl,
} from '@/services/auth/googleAuthorize';
import { mockRouter } from '@/test/mocks/navigation';
import { mockToast } from '@/test/mocks/useToast';

import { useGoogleAuth } from './useGoogleAuth';

const mockGetGoogleAuthorizeLoginUrl = vi.mocked(getGoogleAuthorizeLoginUrl);
const mockGetGoogleAuthorizeSignupUrl = vi.mocked(getGoogleAuthorizeSignupUrl);

describe('useGoogleAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/auth/signin');
  });

  it('should redirect to login authorize URL on success when isSignIn is true', async () => {
    mockGetGoogleAuthorizeLoginUrl.mockResolvedValueOnce({
      authorization_url: 'https://google.com/auth/login',
      state: 'mock-state',
    });

    const { result } = renderHook(() => useGoogleAuth());

    await act(async () => {
      await result.current.handleGoogleAuth(true);
    });

    expect(mockGetGoogleAuthorizeLoginUrl).toHaveBeenCalledTimes(1);
    expect(mockGetGoogleAuthorizeSignupUrl).not.toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith(
      'https://google.com/auth/login'
    );
    expect(mockToast).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
  });

  it('should redirect to signup authorize URL on success when isSignIn is false', async () => {
    mockGetGoogleAuthorizeSignupUrl.mockResolvedValueOnce({
      authorization_url: 'https://google.com/auth/signup',
      state: 'mock-state',
    });

    const { result } = renderHook(() => useGoogleAuth());

    await act(async () => {
      await result.current.handleGoogleAuth(false);
    });

    expect(mockGetGoogleAuthorizeSignupUrl).toHaveBeenCalledTimes(1);
    expect(mockGetGoogleAuthorizeLoginUrl).not.toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith(
      'https://google.com/auth/signup'
    );
    expect(mockToast).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
  });

  it('should trigger destructive toast when login request fails', async () => {
    mockGetGoogleAuthorizeLoginUrl.mockRejectedValueOnce(
      new Error('API error')
    );

    const { result } = renderHook(() => useGoogleAuth());

    await act(async () => {
      await result.current.handleGoogleAuth(true);
    });

    expect(mockGetGoogleAuthorizeLoginUrl).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '登入失敗',
        description: '無法完成 Google 登入，請稍後再試。',
      })
    );
    expect(result.current.isPending).toBe(false);
  });

  it('should trigger destructive toast when signup request fails', async () => {
    mockGetGoogleAuthorizeSignupUrl.mockRejectedValueOnce(
      new Error('API error')
    );

    const { result } = renderHook(() => useGoogleAuth());

    await act(async () => {
      await result.current.handleGoogleAuth(false);
    });

    expect(mockGetGoogleAuthorizeSignupUrl).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: '註冊失敗',
        description: '無法完成 Google 註冊，請稍後再試。',
      })
    );
    expect(result.current.isPending).toBe(false);
  });

  it('saves safe internal callbackUrl from window.location.search when initiating Google sign-in (#733)', async () => {
    window.history.replaceState(
      {},
      '',
      '/auth/signin?callbackUrl=%2Freservation%2Fhistory%3Freservation_id%3D101'
    );
    mockGetGoogleAuthorizeLoginUrl.mockResolvedValueOnce({
      authorization_url: 'https://google.com/auth/login',
      state: 'mock-state',
    });

    const { result } = renderHook(() => useGoogleAuth());

    await act(async () => {
      await result.current.handleGoogleAuth(true);
    });

    expect(window.sessionStorage.getItem(POST_LOGIN_CALLBACK_URL_KEY)).toBe(
      '/reservation/history?reservation_id=101'
    );
  });

  it('rejects unsafe external callbackUrl and clears stale sessionStorage entry during Google sign-in (#733)', async () => {
    window.sessionStorage.setItem(
      POST_LOGIN_CALLBACK_URL_KEY,
      '/reservation/history?reservation_id=88'
    );
    window.history.replaceState(
      {},
      '',
      '/auth/signin?callbackUrl=https%3A%2F%2Fevil.example%2Fphish'
    );
    mockGetGoogleAuthorizeLoginUrl.mockResolvedValueOnce({
      authorization_url: 'https://google.com/auth/login',
      state: 'mock-state',
    });

    const { result } = renderHook(() => useGoogleAuth());

    await act(async () => {
      await result.current.handleGoogleAuth(true);
    });

    expect(
      window.sessionStorage.getItem(POST_LOGIN_CALLBACK_URL_KEY)
    ).toBeNull();
  });

  it('clears saved callbackUrl when getGoogleAuthorizeLoginUrl throws or when initiating signup (#733)', async () => {
    window.history.replaceState(
      {},
      '',
      '/auth/signin?callbackUrl=%2Freservation%2Fhistory%3Freservation_id%3D101'
    );
    mockGetGoogleAuthorizeLoginUrl.mockRejectedValueOnce(
      new Error('API error')
    );

    const { result } = renderHook(() => useGoogleAuth());

    await act(async () => {
      await result.current.handleGoogleAuth(true);
    });

    expect(
      window.sessionStorage.getItem(POST_LOGIN_CALLBACK_URL_KEY)
    ).toBeNull();

    window.sessionStorage.setItem(
      POST_LOGIN_CALLBACK_URL_KEY,
      '/reservation/history?reservation_id=101'
    );
    mockGetGoogleAuthorizeSignupUrl.mockResolvedValueOnce({
      authorization_url: 'https://google.com/auth/signup',
      state: 'mock-state',
    });

    await act(async () => {
      await result.current.handleGoogleAuth(false);
    });

    expect(
      window.sessionStorage.getItem(POST_LOGIN_CALLBACK_URL_KEY)
    ).toBeNull();
  });
});
