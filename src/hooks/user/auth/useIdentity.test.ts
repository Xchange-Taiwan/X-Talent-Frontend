import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseSessionHint = vi.fn();
vi.mock('./useSessionHint', () => ({
  useSessionHint: () => mockUseSessionHint(),
}));

import {
  authenticatedIdentity,
  buildResolvedIdentity,
} from '@/test/mocks/identity';

import { useIdentity } from './useIdentity';

describe('useIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes through the already-resolved identity from useSessionHint unchanged when there is no override', () => {
    const resolved = authenticatedIdentity('user-123', {
      isMentor: true,
      avatar: 'https://example.com/session.png',
    });
    mockUseSessionHint.mockReturnValue(resolved);

    const { result } = renderHook(() => useIdentity(null));

    expect(result.current).toEqual(resolved);
  });

  it('layers the avatar override on top when its userId matches the resolved identity', () => {
    mockUseSessionHint.mockReturnValue(
      authenticatedIdentity('user-123', {
        isMentor: true,
        avatar: 'https://example.com/session.png',
      })
    );

    const { result } = renderHook(() =>
      useIdentity({ userId: 'user-123', url: 'https://example.com/new.png' })
    );

    expect(result.current.avatar).toBe('https://example.com/new.png');
  });

  it('ignores the override when its userId does not match the resolved identity', () => {
    mockUseSessionHint.mockReturnValue(
      authenticatedIdentity('user-123', {
        isMentor: true,
        avatar: 'https://example.com/session.png',
      })
    );

    const { result } = renderHook(() =>
      useIdentity({
        userId: 'different-user',
        url: 'https://example.com/new.png',
      })
    );

    expect(result.current.avatar).toBe('https://example.com/session.png');
  });

  it('ignores the override while the userId has not resolved yet', () => {
    mockUseSessionHint.mockReturnValue(
      buildResolvedIdentity({
        isLoggedIn: true,
        isMentor: true,
        isResolvingUser: true,
      })
    );

    const { result } = renderHook(() =>
      useIdentity({ userId: 'user-123', url: 'https://example.com/new.png' })
    );

    expect(result.current.avatar).toBeUndefined();
  });
});
