import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearUserProfileDtoCache,
  primeUserProfileDtoCache,
} from '@/hooks/user/user-data/useUserProfileDto';
import type { MentorProfileVO } from '@/types/user';

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
    } as unknown as MentorProfileVO);

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBe('optimistic-avatar.png');
  });

  it('subscribes dynamically to userProfileDtoCache updates and updates the avatar immediately', () => {
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

    // Initially should be session avatar
    expect(result.current).toBe('session-avatar.png');

    // Dynamically update the cache inside act()
    act(() => {
      primeUserProfileDtoCache(123, 'zh_TW', {
        user_id: 123,
        avatar: 'optimistic-avatar.png',
      } as unknown as MentorProfileVO);
    });

    // Should dynamically update to the optimistic avatar immediately
    expect(result.current).toBe('optimistic-avatar.png');
  });

  it('falls back to session avatar if the transition period of 10 seconds has expired', () => {
    vi.useFakeTimers();
    const systemTime = new Date('2026-08-23T00:00:00Z');
    vi.setSystemTime(systemTime);

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

    primeUserProfileDtoCache(123, 'zh_TW', {
      user_id: 123,
      avatar: 'optimistic-avatar.png',
    } as unknown as MentorProfileVO);

    const { result, rerender } = renderHook(() => useCurrentAvatar());

    // Within the 10 seconds, it should be optimistic-avatar.png
    expect(result.current).toBe('optimistic-avatar.png');

    // Advance time by 11 seconds
    vi.setSystemTime(new Date(systemTime.getTime() + 11000));
    rerender();

    // After 10 seconds, it should fallback to session avatar
    expect(result.current).toBe('session-avatar.png');

    vi.useRealTimers();
  });

  it('returns null (deletion) during transition period when optimistic avatar is explicitly null', () => {
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

    // Prime the cache with an optimistic avatar set to null (deletion)
    primeUserProfileDtoCache(123, 'zh_TW', {
      user_id: 123,
      avatar: null,
    } as unknown as MentorProfileVO);

    const { result } = renderHook(() => useCurrentAvatar());

    expect(result.current).toBeNull();
  });
});
