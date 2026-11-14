import { fromPartial } from '@total-typescript/shoehorn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MentorProfileVO } from '@/types/user';

import {
  clearUserProfileDtoCache,
  getEffectiveInitialDto,
  getUserProfileDtoFromCache,
  isOptimisticTransitionActive,
  primeUserProfileDtoCache,
  subscribeTransition,
  subscribeUserProfileDtoCache,
  USER_PROFILE_DTO_CACHE_TTL_MS,
  userProfileDtoReadManager,
} from './userProfileDtoCache';

describe('userProfileDtoCache (src/lib/cache)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    userProfileDtoReadManager.clear();
  });

  afterEach(() => {
    userProfileDtoReadManager.clear();
    vi.useRealTimers();
  });

  it('preserves stale DTOs non-destructively past TTL for SWR inspection and skips stale SSR initialData', () => {
    const dto = fromPartial<MentorProfileVO>({
      user_id: 42,
      name: 'Cached Mentor',
    });

    primeUserProfileDtoCache(42, 'zh_TW', dto);
    expect(getUserProfileDtoFromCache(42, 'zh_TW')).toBe(dto);

    vi.advanceTimersByTime(USER_PROFILE_DTO_CACHE_TTL_MS + 1);

    // Expired in strict get(), but preserved for SWR via peek/getSnapshot
    expect(userProfileDtoReadManager.get('42-zh_TW')).toBeUndefined();
    expect(getUserProfileDtoFromCache(42, 'zh_TW')).toBe(dto);
    expect(
      getEffectiveInitialDto(
        '42-zh_TW',
        fromPartial<MentorProfileVO>({ user_id: 42, name: 'Stale SSR' })
      )
    ).toBeUndefined();
  });

  it('cancels competing in-flight reads on primeUserProfileDtoCache and clearUserProfileDtoCache and notifies observers', () => {
    const cacheObserver = vi.fn();
    const transitionObserver = vi.fn();
    const unsubCache = subscribeUserProfileDtoCache(77, 'zh_TW', cacheObserver);
    const unsubTransition = subscribeTransition(transitionObserver);

    let abortedCount = 0;
    const unsubReader = userProfileDtoReadManager.subscribe(
      '77-zh_TW',
      (signal) => {
        signal.addEventListener('abort', () => {
          abortedCount += 1;
        });
        return new Promise<MentorProfileVO | null>(() => {});
      },
      () => {}
    );

    const dto = fromPartial<MentorProfileVO>({
      user_id: 77,
      name: 'Primed User',
    });
    primeUserProfileDtoCache(77, 'zh_TW', dto);

    expect(abortedCount).toBe(1);
    expect(isOptimisticTransitionActive()).toBe(true);
    expect(cacheObserver).toHaveBeenCalledTimes(1);
    expect(transitionObserver).toHaveBeenCalledTimes(1);

    clearUserProfileDtoCache(77, 'zh_TW');

    expect(getUserProfileDtoFromCache(77, 'zh_TW')).toBeNull();
    expect(isOptimisticTransitionActive()).toBe(false);
    expect(cacheObserver).toHaveBeenCalledTimes(2);
    expect(transitionObserver).toHaveBeenCalledTimes(2);

    unsubReader();
    unsubCache();
    unsubTransition();
  });
});
