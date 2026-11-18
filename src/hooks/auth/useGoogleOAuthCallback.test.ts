import { renderHook, waitFor } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import type { Session } from 'next-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@/lib/actions/googleCallback', () => ({
  googleCallback: mockGoogleCallback,
}));

vi.mock('@/actions/auth', () => ({
  revalidateProfilePathAfterDelete: mockRevalidateAfterDelete,
}));

import {
  PENDING_AUTH_CALLBACK_URL_KEY,
  PENDING_VERIFICATION_EMAIL_KEY,
} from '@/lib/auth/authFlowStorage';
import {
  getPendingFavoriteMentorId,
  savePendingFavoriteMentor,
} from '@/lib/favorites';
import { mockRouter, mockSearchParams } from '@/test/mocks/navigation';
import { mockGetSession, mockSignIn } from '@/test/mocks/nextAuth';
import { mockToast } from '@/test/mocks/useToast';
import type { components } from '@/types/api';

import { useGoogleOAuthCallback } from './useGoogleOAuthCallback';

type OAuthCallbackResponse =
  components['schemas']['ApiResponse_GoogleCallbackVO_'];
type ProfileVO = components['schemas']['ProfileVO'];

describe('useGoogleOAuthCallback (#885)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    mockRevalidateAfterDelete.mockResolvedValue(undefined);
    mockSignIn.mockResolvedValue({ error: null, ok: true });
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'code') return 'code_123';
      if (key === 'state') return 'state_456';
      return null;
    });
  });

  it('executes OAuth LOGIN once across rerenders and transitions loading to false', async () => {
    window.sessionStorage.setItem(
      PENDING_AUTH_CALLBACK_URL_KEY,
      '/reservation/mentee?tab=history'
    );
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
    expect(mockRouter.push).toHaveBeenCalledWith(
      '/reservation/mentee?tab=history'
    );
    expect(
      window.sessionStorage.getItem(PENDING_AUTH_CALLBACK_URL_KEY)
    ).toBeNull();
  });

  it('rejects Google LOGIN when getSession returns a session without accessToken', async () => {
    mockGoogleCallback.mockResolvedValue(
      fromPartial<OAuthCallbackResponse>({
        data: {
          auth_type: 'LOGIN',
          auth: { token: 'jwt_tok', email: 'user@example.com' },
          user: fromPartial<ProfileVO>({ user_id: 501 }),
        },
      })
    );
    mockGetSession.mockResolvedValue(
      fromPartial<Session>({
        user: { id: '501', onBoarding: true },
      })
    );

    const { result } = renderHook(() => useGoogleOAuthCallback());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: 'Login failed',
      description: 'Something went wrong during login.',
    });
    expect(mockRouter.push).toHaveBeenCalledWith('/auth/signin');
  });

  it('redirects Google LOGIN to pending favorite profile path via sessionLifecycle when no explicit callbackUrl is stored', async () => {
    savePendingFavoriteMentor(303);
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

    const { result } = renderHook(() => useGoogleOAuthCallback());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockRouter.push).toHaveBeenCalledWith('/profile/303');
    expect(getPendingFavoriteMentorId()).toBe(303);
  });

  describe('server pre-exchanged fast path (#954)', () => {
    it('completes LOGIN without calling googleCallback Server Action or extra getSession round-trip, forwarding sealed refreshBridge to signIn', async () => {
      window.sessionStorage.setItem(
        PENDING_AUTH_CALLBACK_URL_KEY,
        '/reservation/mentee'
      );

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
      expect(mockRouter.push).toHaveBeenCalledWith('/reservation/mentee');
    });

    it('routes incomplete onboarding users to /auth/onboarding on the fast path', async () => {
      const { result } = renderHook(() =>
        useGoogleOAuthCallback({
          response: fromPartial<OAuthCallbackResponse>({
            code: '0',
            msg: 'ok',
            data: {
              auth_type: 'LOGIN',
              auth: { token: 'fast_jwt', email: 'newbie@example.com' },
              user: fromPartial<ProfileVO>({
                user_id: 778,
                onboarding: false,
                is_mentor: false,
              }),
            },
          }),
          refreshBridgeToken: 'encrypted_jwe_bridge_778',
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockGoogleCallback).not.toHaveBeenCalled();
      expect(mockRouter.push).toHaveBeenCalledWith('/auth/onboarding');
    });

    it('completes SIGNUP without calling googleCallback Server Action and stores pending verification email', async () => {
      const { result } = renderHook(() =>
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

      expect(mockGoogleCallback).not.toHaveBeenCalled();
      expect(
        window.sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY)
      ).toBe('signup@example.com');
      expect(mockRouter.push).toHaveBeenCalledWith('/auth/email-verify');
    });

    it('never re-sends single-use code via googleCallback when server pre-exchange failed', async () => {
      const { result } = renderHook(() =>
        useGoogleOAuthCallback({
          response: {
            code: '400',
            msg: 'Google OAuth callback failed',
            data: null,
          },
          refreshBridgeToken: null,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockGoogleCallback).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: 'Login failed',
        })
      );
      expect(mockRouter.push).toHaveBeenCalledWith('/auth/signin');
    });

    it('treats whitespace-only ?code=%20&state=%20 as missing params without invoking googleCallback Server Action (#954)', async () => {
      mockSearchParams.get.mockImplementation((key: string) =>
        key === 'code' || key === 'state' ? '   ' : null
      );

      const { result } = renderHook(() => useGoogleOAuthCallback(null));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockGoogleCallback).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: 'Missing Google OAuth parameters',
        })
      );
      expect(mockRouter.push).toHaveBeenCalledWith('/auth/signin');
    });
  });
});
