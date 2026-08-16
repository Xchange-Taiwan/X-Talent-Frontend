import { renderHook } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { useSession } from 'next-auth/react';
import { describe, expect, it, vi } from 'vitest';

import { useAuthStatus } from '@/hooks/user/auth/useAuthStatus';
import { useProfileAuth } from '@/hooks/user/auth/useProfileAuth';
import { useSessionHint } from '@/hooks/user/auth/useSessionHint';
import { useCurrentAvatar } from '@/hooks/user/profile/useCurrentAvatar';
import { readCookie } from '@/lib/auth/sessionHint';

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

vi.mock('@/lib/auth/sessionHint', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/auth/sessionHint')>();
  return {
    ...actual,
    readCookie: vi.fn(),
  };
});

const mockUseSession = vi.mocked(useSession);
const mockReadCookie = vi.mocked(readCookie);

describe('sharedIdentityAgreement integration test', () => {
  it('all four call sites agree on identity for an authenticated mentor session + cookie input', () => {
    mockUseSession.mockReturnValue(
      fromPartial({
        data: fromPartial({
          user: { id: 'user-123', isMentor: true, avatar: 'avatar.png' },
        }),
        status: 'authenticated',
      })
    );

    mockReadCookie.mockReturnValue('1|user-123|avatar.png');

    const { result: hintResult } = renderHook(() => useSessionHint());
    const { result: avatarResult } = renderHook(() => useCurrentAvatar());
    const { result: profileAuthResult } = renderHook(() =>
      useProfileAuth('user-123')
    );
    const { result: authStatusResult } = renderHook(() => useAuthStatus());

    expect(hintResult.current).toMatchObject({
      status: 'authenticated',
      isMentor: true,
      userId: 'user-123',
      avatar: 'avatar.png',
    });

    expect(avatarResult.current).toBe('avatar.png');
    expect(profileAuthResult.current.isAuthorized).toBe(true);
    expect(authStatusResult.current).toMatchObject({
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
    mockReadCookie.mockReturnValue(undefined);

    const { result: hintResult } = renderHook(() => useSessionHint());
    const { result: avatarResult } = renderHook(() => useCurrentAvatar());
    const { result: profileAuthResult } = renderHook(() =>
      useProfileAuth('user-123')
    );
    const { result: authStatusResult } = renderHook(() => useAuthStatus());

    expect(hintResult.current).toEqual({ status: 'guest' });
    expect(avatarResult.current).toBeNull();
    expect(profileAuthResult.current.isAuthorized).toBe(false);
    expect(authStatusResult.current).toMatchObject({
      authKnown: true,
      isLoggedIn: false,
      isMentor: false,
      userId: undefined,
      hasFullUser: false,
      isResolvingUser: false,
    });
  });

  it('does not trigger redirect in useProfileAuth during loading if identity is unknown', () => {
    mockUseSession.mockReturnValue(
      fromPartial({
        data: null,
        status: 'loading',
      })
    );
    mockReadCookie.mockReturnValue(undefined);
    mockPush.mockClear();

    const { result } = renderHook(() => useProfileAuth('user-123'));

    expect(result.current.isAuthorized).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
