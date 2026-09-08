import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MentorProfileVO } from '@/types/user';

const mockGetUserProfileDtoFromCache =
  vi.fn<(userId: number, language: string) => MentorProfileVO | undefined>();
const mockIsOptimisticTransitionActive = vi.fn<() => boolean>();
const mockSubscribeUserProfileDtoCache = vi.fn<
  (userId: number, language: string, listener: () => void) => () => void
>(() => vi.fn());
const mockSubscribeTransition = vi.fn<(listener: () => void) => () => void>(
  () => vi.fn()
);

vi.mock('@/hooks/user/user-data/userProfileDtoCache', () => ({
  getUserProfileDtoFromCache: (userId: number, language: string) =>
    mockGetUserProfileDtoFromCache(userId, language),
  isOptimisticTransitionActive: () => mockIsOptimisticTransitionActive(),
  subscribeUserProfileDtoCache: (
    userId: number,
    language: string,
    listener: () => void
  ) => mockSubscribeUserProfileDtoCache(userId, language, listener),
  subscribeTransition: (listener: () => void) =>
    mockSubscribeTransition(listener),
}));

import { useOptimisticIdentity } from './useOptimisticIdentity';

function makeDto(overrides: Partial<MentorProfileVO> = {}): MentorProfileVO {
  return {
    user_id: 1,
    name: 'Ada',
    avatar: 'https://example.com/a.png',
    is_mentor: false,
    onboarding: true,
    ...overrides,
  } as MentorProfileVO;
}

describe('useOptimisticIdentity - snapshot reference stability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeUserProfileDtoCache.mockReturnValue(vi.fn());
    mockSubscribeTransition.mockReturnValue(vi.fn());
  });

  it('returns undefined when no transition is active', () => {
    mockIsOptimisticTransitionActive.mockReturnValue(false);
    const { result } = renderHook(() => useOptimisticIdentity(1));

    expect(result.current).toBeUndefined();
  });

  it('returns the same IdentityPatch reference across re-renders when the cached DTO has not changed', () => {
    const dto = makeDto();
    mockIsOptimisticTransitionActive.mockReturnValue(true);
    mockGetUserProfileDtoFromCache.mockReturnValue(dto);

    const { result, rerender } = renderHook(() => useOptimisticIdentity(1));
    const first = result.current;
    expect(first).toBeDefined();

    rerender();
    const second = result.current;

    expect(second).toBe(first);
  });

  it('derives a new IdentityPatch when the underlying cached DTO reference changes', () => {
    mockIsOptimisticTransitionActive.mockReturnValue(true);
    mockGetUserProfileDtoFromCache.mockReturnValue(makeDto({ name: 'Ada' }));

    const { result } = renderHook(() => useOptimisticIdentity(1));
    const first = result.current;

    act(() => {
      mockGetUserProfileDtoFromCache.mockReturnValue(
        makeDto({ name: 'Grace' })
      );
      // Trigger a re-render the same way a real store notification would -
      // subscribe's listener callback re-invokes getSnapshot.
      const listener = mockSubscribeUserProfileDtoCache.mock.calls[0][2];
      listener();
    });

    expect(result.current).not.toBe(first);
    expect(result.current?.name).toBe('Grace');
  });

  it('falls back to undefined once the transition is no longer active', () => {
    mockIsOptimisticTransitionActive.mockReturnValue(true);
    mockGetUserProfileDtoFromCache.mockReturnValue(makeDto());

    const { result } = renderHook(() => useOptimisticIdentity(1));
    expect(result.current).toBeDefined();

    act(() => {
      mockIsOptimisticTransitionActive.mockReturnValue(false);
      const listener = mockSubscribeTransition.mock.calls[0][0];
      listener();
    });

    expect(result.current).toBeUndefined();
  });
});
