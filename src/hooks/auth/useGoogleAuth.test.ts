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

  it('persists sanitized callbackUrl to sessionStorage before Google sign-in redirect (#733)', async () => {
    window.sessionStorage.clear();
    const originalUrl = window.location.href;
    window.history.replaceState(
      {},
      '',
      '/auth/signin?callbackUrl=%2Freservation%2Fmentee%3Ftab%3Dhistory%26reservationId%3D101'
    );

    mockGetGoogleAuthorizeLoginUrl.mockResolvedValueOnce({
      authorization_url: 'https://google.com/auth/login',
      state: 'mock-state',
    });

    const { result } = renderHook(() => useGoogleAuth());

    await act(async () => {
      await result.current.handleGoogleAuth(true);
    });

    expect(window.sessionStorage.getItem('pending_auth_callback_url')).toBe(
      '/reservation/mentee?tab=history&reservationId=101'
    );

    window.history.replaceState({}, '', originalUrl);
  });
});
