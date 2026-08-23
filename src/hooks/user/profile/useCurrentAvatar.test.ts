import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearUserProfileDtoCache,
  primeUserProfileDtoCache,
} from '@/hooks/user/user-data/useUserProfileDto';

import { useCurrentAvatar } from './useCurrentAvatar';

const mockUseResolvedIdentity = vi.fn();
vi.mock('@/hooks/user/auth/useResolvedIdentity', () => ({
  useResolvedIdentity: () => mockUseResolvedIdentity(),
}));

describe('useCurrentAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearUserProfileDtoCache(123, 'zh_TW');
  });

  it('returns session avatar when present', () => {
    mockUseResolvedIdentity.mockReturnValue({
      state: 'confirmed-member',
      userId: '123',
      avatar: 'session-avatar.png',
      isMentor: false,
      isLoggedIn: true,
      hasFullUser: true,
      isResolvingUser: false,
      authKnown: true,
      sessionSettled: true,
    });

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBe('session-avatar.png');
  });

  it('returns null when session has no avatar', () => {
    mockUseResolvedIdentity.mockReturnValue({
      state: 'confirmed-member',
      userId: '123',
      avatar: undefined,
      isMentor: false,
      isLoggedIn: true,
      hasFullUser: true,
      isResolvingUser: false,
      authKnown: true,
      sessionSettled: true,
    });

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBeNull();
  });

  it('returns optimistic avatar during transition period, prioritizing it over session avatar', () => {
    mockUseResolvedIdentity.mockReturnValue({
      state: 'confirmed-member',
      userId: '123',
      avatar: 'session-avatar.png',
      isMentor: false,
      isLoggedIn: true,
      hasFullUser: true,
      isResolvingUser: false,
      authKnown: true,
      sessionSettled: true,
    });

    // Prime the cache with an optimistic avatar for user 123
    primeUserProfileDtoCache(123, 'zh_TW', {
      user_id: 123,
      avatar: 'optimistic-avatar.png',
    } as any);

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBe('optimistic-avatar.png');
  });
});
