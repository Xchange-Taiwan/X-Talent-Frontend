import { renderHook, waitFor } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import type { Session } from 'next-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGoogleCallback, mockRevalidateAfterDelete } = vi.hoisted(() => ({
  mockGoogleCallback: vi.fn(),
  mockRevalidateAfterDelete: vi.fn(),
}));

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
  googleCallback: mockGoogleCallback,
  revalidateProfilePathAfterDelete: mockRevalidateAfterDelete,
}));

import {
  authLifecycle,
  createAuthLifecycle,
  createInMemorySessionStorage,
  PENDING_AUTH_CALLBACK_URL_KEY,
  PENDING_VERIFICATION_EMAIL_KEY,
} from '@/lib/auth/sessionLifecycle';
import { mockRouter, mockSearchParams } from '@/test/mocks/navigation';
import { mockGetSession, mockSignIn } from '@/test/mocks/nextAuth';
import { mockToast } from '@/test/mocks/useToast';
import type { components } from '@/types/api';

import { useGoogleOAuthCallback } from './useGoogleOAuthCallback';

type OAuthCallbackResponse =
  components['schemas']['ApiResponse_GoogleCallbackVO_'];
type ProfileVO = components['schemas']['ProfileVO'];

describe('useGoogleOAuthCallback (#885 / #940)', () => {
  let storage = createInMemorySessionStorage();

  beforeEach(() => {
    vi.clearAllMocks();
    storage = createInMemorySessionStorage();
    mockRevalidateAfterDelete.mockResolvedValue(undefined);
    mockSignIn.mockResolvedValue({ error: null, ok: true });
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'code') return 'code_123';
      if (key === 'state') return 'state_456';
      return null;
    });

    const scoped = createAuthLifecycle({
      storage,
      trackEvent: vi.fn(),
      setAnalyticsUserContext: vi.fn(),
      clearAnalyticsUser: vi.fn(),
      captureFailure: vi.fn(),
      getOrigin: () => 'https://xtalent.tw',
    });
    vi.spyOn(authLifecycle, 'handleGoogleOAuthCallback').mockImplementation(
      (params, overrides) => scoped.handleGoogleOAuthCallback(params, overrides)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('executes OAuth LOGIN once across Strict Mode rerenders and transitions loading to false', async () => {
    storage.setItem(PENDING_AUTH_CALLBACK_URL_KEY, '/reservation/mentee');
    mockGoogleCallback.mockResolvedValue(
      fromPartial<OAuthCallbackResponse>({
        data: {
          auth_type: 'LOGIN',
          auth: { token: 'jwt_tok', email: 'user@example.com' },
          user: fromPartial<ProfileVO>({ user_id: 501, is_mentor: false }),
        },
      })
    );
    mockGetSession.mockResolvedValue(
      fromPartial<Session>({
        accessToken: 'jwt_tok',
        user: { id: '501', onBoarding: true, isMentor: false },
      })
    );

    const { result, rerender } = renderHook(() => useGoogleOAuthCallback());
    rerender();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGoogleCallback).toHaveBeenCalledTimes(1);
    expect(mockGoogleCallback).toHaveBeenCalledWith('code_123', 'state_456');
    expect(mockRouter.push).toHaveBeenCalledWith('/reservation/mentee');
    expect(storage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)).toBeNull();
  });

  it('forwards server initialPreExchanged fast-path without calling googleCallback or getSession (#954)', async () => {
    const { result } = renderHook(() =>
      useGoogleOAuthCallback({
        response: fromPartial<OAuthCallbackResponse>({
          code: '0',
          msg: 'ok',
          data: {
            auth_type: 'LOGIN',
            auth: { token: 'fast_jwt', email: 'fast@example.com' },
            user: fromPartial<ProfileVO>({
              user_id: 777,
              onboarding: true,
              is_mentor: true,
            }),
          },
        }),
        refreshBridgeToken: 'encrypted_jwe_bridge_954',
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGoogleCallback).not.toHaveBeenCalled();
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockSignIn).toHaveBeenCalledWith(
      'custom-google-token',
      expect.objectContaining({
        redirect: false,
        token: 'fast_jwt',
        email: 'fast@example.com',
        refreshBridge: 'encrypted_jwe_bridge_954',
      })
    );
    expect(mockRouter.push).toHaveBeenCalledWith('/mentor-pool');
  });

  it('handles pre-exchanged SIGNUP and whitespace-only missing params cleanly (#954)', async () => {
    const { result, unmount } = renderHook(() =>
      useGoogleOAuthCallback({
        response: fromPartial<OAuthCallbackResponse>({
          code: '0',
          msg: 'ok',
          data: {
            auth_type: 'SIGNUP',
            auth: { email: 'signup@example.com' },
          },
        }),
        refreshBridgeToken: null,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(storage.getItem(PENDING_VERIFICATION_EMAIL_KEY)).toBe(
      'signup@example.com'
    );
    expect(mockRouter.push).toHaveBeenCalledWith('/auth/email-verify');
    unmount();

    mockSearchParams.get.mockImplementation((key: string) =>
      key === 'code' || key === 'state' ? '   ' : null
    );
    const { result: missingResult } = renderHook(() =>
      useGoogleOAuthCallback(null)
    );
    await waitFor(() => {
      expect(missingResult.current.loading).toBe(false);
    });
    expect(mockGoogleCallback).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: 'Missing Google OAuth parameters',
      })
    );
  });
});
