import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

const mockUseSessionHint = vi.fn();
vi.mock('./useSessionHint', () => ({
  useSessionHint: () => mockUseSessionHint(),
}));

import { mockSession, mockUseSession } from '@/test/mocks/nextAuth';

import { useIdentity } from './useIdentity';

describe('useIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is unresolved while both the session and the hint are still loading', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    mockUseSessionHint.mockReturnValue({ status: 'unknown' });

    const { result } = renderHook(() => useIdentity(null));

    expect(result.current).toMatchObject({
      authKnown: false,
      isLoggedIn: false,
      isResolvingUser: false,
      userId: undefined,
      hasFullUser: false,
    });
  });

  it('renders as guest immediately once the hint resolves, even before the session does', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    mockUseSessionHint.mockReturnValue({ status: 'guest' });

    const { result } = renderHook(() => useIdentity(null));

    expect(result.current).toMatchObject({
      authKnown: true,
      isLoggedIn: false,
      isResolvingUser: false,
    });
  });

  it('flags isResolvingUser when the hint says authenticated but the full session has not landed — must not expose a userId', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    mockUseSessionHint.mockReturnValue({
      status: 'authenticated',
      isMentor: true,
    });

    const { result } = renderHook(() => useIdentity(null));

    expect(result.current).toEqual({
      authKnown: true,
      isLoggedIn: true,
      isMentor: true,
      userId: undefined,
      hasFullUser: false,
      isResolvingUser: true,
      avatar: undefined,
    });
  });

  it('prefers the real session over a stale "authenticated" hint once the session resolves to logged out', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    mockUseSessionHint.mockReturnValue({
      status: 'authenticated',
      isMentor: true,
    });

    const { result } = renderHook(() => useIdentity(null));

    expect(result.current).toMatchObject({
      isLoggedIn: false,
      isResolvingUser: false,
    });
  });

  it('keeps showing the cached user during a NextAuth update() call — status flips to "loading" but data is retained', () => {
    // Mirrors NextAuth v4: calling session.update() sets status back to
    // "loading" while `data` still holds the previous session.
    mockUseSession.mockReturnValue({ data: mockSession, status: 'loading' });
    mockUseSessionHint.mockReturnValue({ status: 'unknown' });

    const { result } = renderHook(() => useIdentity(null));

    expect(result.current).toEqual({
      authKnown: true,
      isLoggedIn: true,
      isMentor: false,
      userId: mockSession.user.id,
      hasFullUser: true,
      isResolvingUser: false,
      avatar: undefined,
    });
  });

  it('uses the real session data once it lands, ignoring the hint', () => {
    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
    });
    mockUseSessionHint.mockReturnValue({ status: 'unknown' });

    const { result } = renderHook(() => useIdentity(null));

    expect(result.current).toEqual({
      authKnown: true,
      isLoggedIn: true,
      isMentor: false,
      userId: mockSession.user.id,
      hasFullUser: true,
      isResolvingUser: false,
      avatar: undefined,
    });
  });

  it('uses the hint userId and clears isResolvingUser when the session is still loading but hint has a userId', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    mockUseSessionHint.mockReturnValue({
      status: 'authenticated',
      isMentor: true,
      userId: 'user-123',
    });

    const { result } = renderHook(() => useIdentity(null));

    expect(result.current).toEqual({
      authKnown: true,
      isLoggedIn: true,
      isMentor: true,
      userId: 'user-123',
      hasFullUser: false,
      isResolvingUser: false,
      avatar: undefined,
    });
  });
});
