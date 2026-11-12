import { renderHook, waitFor } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    clearAnalyticsUser: vi.fn(),
    setAnalyticsUserContext: vi.fn(),
    trackEvent: vi.fn(),
  };
});

vi.mock('@/lib/auth/dispatchDeleteAccountRevalidate', () => ({
  dispatchDeleteAccountRevalidate: vi.fn(),
}));

vi.mock('@/lib/auth/oauthOutcome', () => ({
  clearPendingDeleteAccountEmail: vi.fn(),
  getPendingDeleteAccountEmail: vi.fn(),
  resolveOAuthOutcome: vi.fn(),
  signInWithGoogleToken: vi.fn(),
}));

vi.mock('@/services/auth/deleteAccount', () => ({
  deleteAccount: vi.fn(),
}));

import {
  getPendingDeleteAccountEmail,
  resolveOAuthOutcome,
  signInWithGoogleToken,
} from '@/lib/auth/oauthOutcome';
import {
  POST_LOGIN_CALLBACK_URL_KEY,
  savePostLoginCallbackUrl,
} from '@/lib/url/resolveSafeCallbackUrl';
import { mockRouter, mockSearchParams } from '@/test/mocks/navigation';
import { mockGetSession, mockSession } from '@/test/mocks/nextAuth';
import { mockToast } from '@/test/mocks/useToast';
import type { components } from '@/types/api';

import { useGoogleOAuthCallback } from './useGoogleOAuthCallback';

type GoogleCallbackVO = components['schemas']['GoogleCallbackVO'];

const mockGetPendingDeleteAccountEmail = vi.mocked(
  getPendingDeleteAccountEmail
);
const mockResolveOAuthOutcome = vi.mocked(resolveOAuthOutcome);
const mockSignInWithGoogleToken = vi.mocked(signInWithGoogleToken);

function makeLoginData(
  overrides: Partial<GoogleCallbackVO> = {}
): GoogleCallbackVO {
  return fromPartial<GoogleCallbackVO>({
    auth_type: 'LOGIN',
    auth: {
      token: 'google-jwt-token',
      email: 'mentee@example.com',
    },
    user: fromPartial<NonNullable<GoogleCallbackVO['user']>>({
      user_id: 1,
      is_mentor: false,
    }),
    ...overrides,
  });
}

describe('useGoogleOAuthCallback (#733)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'code') return 'oauth-code';
      if (key === 'state') return 'oauth-state';
      return null;
    });
    mockGetPendingDeleteAccountEmail.mockReturnValue(null);
    mockSignInWithGoogleToken.mockResolvedValue(fromPartial({ ok: true }));
    mockGetSession.mockResolvedValue({
      ...mockSession,
      user: { ...mockSession.user, onBoarding: true, isMentor: false },
    });
  });

  it('consumes safe post_login_callback_url from sessionStorage and redirects there on OAuth login success', async () => {
    savePostLoginCallbackUrl('/reservation/history?reservation_id=101');
    mockResolveOAuthOutcome.mockResolvedValueOnce({
      type: 'LOGIN',
      data: makeLoginData(),
    });

    const { result } = renderHook(() => useGoogleOAuthCallback());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockRouter.push).toHaveBeenCalledWith(
      '/reservation/history?reservation_id=101'
    );
    expect(
      window.sessionStorage.getItem(POST_LOGIN_CALLBACK_URL_KEY)
    ).toBeNull();
  });

  it('consumes tampered unsafe post_login_callback_url from sessionStorage and falls back to /mentor-pool', async () => {
    window.sessionStorage.setItem(
      POST_LOGIN_CALLBACK_URL_KEY,
      'https://evil.example/phish'
    );
    mockResolveOAuthOutcome.mockResolvedValueOnce({
      type: 'LOGIN',
      data: makeLoginData(),
    });

    const { result } = renderHook(() => useGoogleOAuthCallback());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/mentor-pool');
    expect(
      window.sessionStorage.getItem(POST_LOGIN_CALLBACK_URL_KEY)
    ).toBeNull();
  });

  it('prioritizes /auth/onboarding when session.user.onBoarding is false while still clearing stored callbackUrl', async () => {
    savePostLoginCallbackUrl('/reservation/history?reservation_id=101');
    mockResolveOAuthOutcome.mockResolvedValueOnce({
      type: 'LOGIN',
      data: makeLoginData(),
    });
    mockGetSession.mockResolvedValueOnce({
      ...mockSession,
      user: { ...mockSession.user, onBoarding: false, isMentor: false },
    });

    const { result } = renderHook(() => useGoogleOAuthCallback());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/auth/onboarding');
    expect(
      window.sessionStorage.getItem(POST_LOGIN_CALLBACK_URL_KEY)
    ).toBeNull();
  });

  it('clears stored callbackUrl when OAuth outcome is INVALID', async () => {
    savePostLoginCallbackUrl('/reservation/history?reservation_id=101');
    mockResolveOAuthOutcome.mockResolvedValueOnce({
      type: 'INVALID',
      errorType: 'CALLBACK_FAILED',
    });

    const { result } = renderHook(() => useGoogleOAuthCallback());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: 'Login failed',
      })
    );
    expect(mockRouter.push).toHaveBeenCalledWith('/auth/signin');
    expect(
      window.sessionStorage.getItem(POST_LOGIN_CALLBACK_URL_KEY)
    ).toBeNull();
  });

  it('clears stored callbackUrl when signInWithGoogleToken throws or login payload is incomplete', async () => {
    savePostLoginCallbackUrl('/reservation/history?reservation_id=101');
    mockResolveOAuthOutcome.mockResolvedValueOnce({
      type: 'LOGIN',
      data: makeLoginData(),
    });
    mockSignInWithGoogleToken.mockRejectedValueOnce(new Error('Token error'));

    const { result, unmount } = renderHook(() => useGoogleOAuthCallback());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/auth/signin');
    expect(
      window.sessionStorage.getItem(POST_LOGIN_CALLBACK_URL_KEY)
    ).toBeNull();

    unmount();
    vi.clearAllMocks();
    savePostLoginCallbackUrl('/reservation/history?reservation_id=101');
    mockResolveOAuthOutcome.mockResolvedValueOnce({
      type: 'LOGIN',
      data: makeLoginData({
        auth: { token: null, email: 'mentee@example.com' },
      }),
    });

    const secondRender = renderHook(() => useGoogleOAuthCallback());

    await waitFor(() => {
      expect(secondRender.result.current.loading).toBe(false);
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/auth/signin');
    expect(
      window.sessionStorage.getItem(POST_LOGIN_CALLBACK_URL_KEY)
    ).toBeNull();
  });
});
