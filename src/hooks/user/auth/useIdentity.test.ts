import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseSessionHint = vi.fn();
vi.mock('./useSessionHint', () => ({
  useSessionHint: () => mockUseSessionHint(),
}));

import { useIdentity } from './useIdentity';

describe('useIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes through the already-resolved identity from useSessionHint unchanged when there is no override', () => {
    const resolved = {
      authKnown: true,
      isLoggedIn: true,
      isMentor: true,
      userId: 'user-123',
      hasFullUser: true,
      isResolvingUser: false,
      avatar: 'https://example.com/session.png',
    };
    mockUseSessionHint.mockReturnValue(resolved);

    const { result } = renderHook(() => useIdentity(null));

    expect(result.current).toEqual(resolved);
  });

  it('layers the avatar override on top when its userId matches the resolved identity', () => {
    mockUseSessionHint.mockReturnValue({
      authKnown: true,
      isLoggedIn: true,
      isMentor: true,
      userId: 'user-123',
      hasFullUser: true,
      isResolvingUser: false,
      avatar: 'https://example.com/session.png',
    });

    const { result } = renderHook(() =>
      useIdentity({ userId: 'user-123', url: 'https://example.com/new.png' })
    );

    expect(result.current.avatar).toBe('https://example.com/new.png');
  });

  it('ignores the override when its userId does not match the resolved identity', () => {
    mockUseSessionHint.mockReturnValue({
      authKnown: true,
      isLoggedIn: true,
      isMentor: true,
      userId: 'user-123',
      hasFullUser: true,
      isResolvingUser: false,
      avatar: 'https://example.com/session.png',
    });

    const { result } = renderHook(() =>
      useIdentity({
        userId: 'different-user',
        url: 'https://example.com/new.png',
      })
    );

    expect(result.current.avatar).toBe('https://example.com/session.png');
  });

  it('ignores the override while the userId has not resolved yet', () => {
    mockUseSessionHint.mockReturnValue({
      authKnown: true,
      isLoggedIn: true,
      isMentor: true,
      userId: undefined,
      hasFullUser: false,
      isResolvingUser: true,
      avatar: undefined,
    });

    const { result } = renderHook(() =>
      useIdentity({ userId: 'user-123', url: 'https://example.com/new.png' })
    );

    expect(result.current.avatar).toBeUndefined();
  });
});
