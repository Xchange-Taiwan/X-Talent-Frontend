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

import { PENDING_AUTH_CALLBACK_URL_KEY } from '@/lib/auth/authFlowStorage';
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
});
