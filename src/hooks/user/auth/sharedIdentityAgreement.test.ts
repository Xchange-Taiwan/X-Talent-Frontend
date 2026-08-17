import { renderHook } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { useSession } from 'next-auth/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useIdentity } from '@/hooks/user/auth/useIdentity';
import { useProfileAuth } from '@/hooks/user/auth/useProfileAuth';
import { useSessionHint } from '@/hooks/user/auth/useSessionHint';
import { useCurrentAvatar } from '@/hooks/user/profile/useCurrentAvatar';
import { SESSION_HINT_COOKIE } from '@/lib/auth/sessionHint';

const mockPush = vi.fn();

vi.mock('next/navigation', async () => {
  return {
    useRouter: () => ({
      push: mockPush,
    }),
  };
});

vi.mock('next-auth/react', async () => {
  return {
    useSession: vi.fn(),
  };
});

vi.mock('@/lib/avatar/avatarOverrideStore', () => ({
  clearAvatarOverride: vi.fn(),
  useAvatarOverride: vi.fn(() => null),
}));

const mockUseSession = vi.mocked(useSession);

describe('sharedIdentityAgreement integration test', () => {
  beforeEach(() => {
    // Clean up cookies
    document.cookie = `${SESSION_HINT_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    mockPush.mockClear();
  });

  it('all four call sites agree on identity for an authenticated mentor session + cookie input', () => {
    mockUseSession.mockReturnValue(
      fromPartial({
        data: fromPartial({
          user: { id: 'user-123', isMentor: true, avatar: '/avatar.png' },
        }),
        status: 'authenticated',
      })
    );

    document.cookie = `${SESSION_HINT_COOKIE}=1|user-123|%2Favatar.png`;

    const { result: hintResult } = renderHook(() => useSessionHint());
    const { result: avatarResult } = renderHook(() => useCurrentAvatar());
    const { result: profileAuthResult } = renderHook(() =>
      useProfileAuth('user-123')
    );
    const { result: identityResult } = renderHook(() => useIdentity(null));

    expect(hintResult.current).toMatchObject({
      status: 'authenticated',
      isMentor: true,
      userId: 'user-123',
      avatar: '/avatar.png',
    });

    expect(avatarResult.current).toBe('/avatar.png');
    expect(profileAuthResult.current.isAuthorized).toBe(true);
    expect(identityResult.current).toMatchObject({
      authKnown: true,
      isLoggedIn: true,
      isMentor: true,
      userId: 'user-123',
      hasFullUser: true,
      isResolvingUser: false,
    });
  });

  it('all four call sites agree on identity for a guest (unauthenticated) session', () => {
    mockUseSession.mockReturnValue(
      fromPartial({
        data: null,
        status: 'unauthenticated',
      })
    );
    mockPush.mockClear();

    const { result: hintResult } = renderHook(() => useSessionHint());
    const { result: avatarResult } = renderHook(() => useCurrentAvatar());
    const { result: profileAuthResult } = renderHook(() =>
      useProfileAuth('user-123')
    );
    const { result: identityResult } = renderHook(() => useIdentity(null));

    expect(hintResult.current).toEqual({ status: 'guest', hasCookie: false });
    expect(avatarResult.current).toBeNull();
    expect(profileAuthResult.current.isAuthorized).toBe(false);
    expect(mockPush).toHaveBeenCalledWith('/');
    expect(identityResult.current).toMatchObject({
      authKnown: true,
      isLoggedIn: false,
      isMentor: false,
      userId: undefined,
      hasFullUser: false,
      isResolvingUser: false,
    });
  });

  it('redirects useProfileAuth when user is logged in but pageUserId does not match resolved userId', () => {
    mockUseSession.mockReturnValue(
      fromPartial({
        data: fromPartial({
          user: { id: 'user-mismatched', isMentor: false },
        }),
        status: 'authenticated',
      })
    );
    mockPush.mockClear();

    const { result } = renderHook(() => useProfileAuth('user-123'));

    expect(result.current.isAuthorized).toBe(false);
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('all four call sites agree on identity during loading when a valid cookie hint is present', () => {
    mockUseSession.mockReturnValue(
      fromPartial({
        data: null,
        status: 'loading',
      })
    );

    document.cookie = `${SESSION_HINT_COOKIE}=1|user-123|%2Favatar.png`;

    const { result: hintResult } = renderHook(() => useSessionHint());
    const { result: avatarResult } = renderHook(() => useCurrentAvatar());
    const { result: profileAuthResult } = renderHook(() =>
      useProfileAuth('user-123')
    );
    const { result: identityResult } = renderHook(() => useIdentity(null));

    expect(hintResult.current).toMatchObject({
      status: 'authenticated',
      isMentor: true,
      userId: 'user-123',
      avatar: '/avatar.png',
    });

    expect(avatarResult.current).toBe('/avatar.png');
    expect(profileAuthResult.current.isAuthorized).toBe(true);
    expect(identityResult.current).toMatchObject({
      authKnown: true,
      isLoggedIn: true,
      isMentor: true,
      userId: 'user-123',
      hasFullUser: false,
      isResolvingUser: false,
    });
  });

  it('all four call sites agree on identity during loading and no cookie hint is present, and does not prematurely redirect', () => {
    mockUseSession.mockReturnValue(
      fromPartial({
        data: null,
        status: 'loading',
      })
    );
    mockPush.mockClear();

    const { result: hintResult } = renderHook(() => useSessionHint());
    const { result: avatarResult } = renderHook(() => useCurrentAvatar());
    const { result: profileAuthResult } = renderHook(() =>
      useProfileAuth('user-123')
    );
    const { result: identityResult } = renderHook(() => useIdentity(null));

    // No cookie means the visitor's identity is genuinely unknown while the
    // session is still loading (they could still turn out to be logged in) -
    // so this must NOT be treated as a confirmed guest yet.
    expect(hintResult.current).toEqual({ status: 'guest', hasCookie: false });
    expect(avatarResult.current).toBeNull();
    expect(profileAuthResult.current.isAuthorized).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();
    expect(identityResult.current).toMatchObject({
      authKnown: false,
      isLoggedIn: false,
      isMentor: false,
      userId: undefined,
      hasFullUser: false,
      isResolvingUser: false,
    });
  });
});
