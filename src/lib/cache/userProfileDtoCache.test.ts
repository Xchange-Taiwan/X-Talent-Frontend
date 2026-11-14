import { fromPartial } from '@total-typescript/shoehorn';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MentorProfileVO } from '@/types/user';

import {
  clearUserProfileDtoCache,
  getEffectiveInitialDto,
  getUserProfileDtoFromCache,
  isOptimisticTransitionActive,
  primeUserProfileDtoCache,
  resolveUserProfileDtoFetch,
  shouldCacheUserProfileDto,
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

  describe('shouldCacheUserProfileDto', () => {
    it('returns false for unexpired same-reference DTOs and null, and true for expired or different-reference DTOs', () => {
      const dto = fromPartial<MentorProfileVO>({
        user_id: 50,
        name: 'Cached Mentor',
      });
      const differentDto = fromPartial<MentorProfileVO>({
        user_id: 50,
        name: 'Updated Mentor',
      });

      primeUserProfileDtoCache(50, 'zh_TW', dto);

      expect(shouldCacheUserProfileDto('50-zh_TW', dto)).toBe(false);
      expect(shouldCacheUserProfileDto('50-zh_TW', differentDto)).toBe(true);
      expect(shouldCacheUserProfileDto('50-zh_TW', null)).toBe(false);
      expect(shouldCacheUserProfileDto(null, null)).toBe(false);

      vi.advanceTimersByTime(USER_PROFILE_DTO_CACHE_TTL_MS + 1);

      expect(userProfileDtoReadManager.get('50-zh_TW')).toBeUndefined();
      expect(userProfileDtoReadManager.peek('50-zh_TW')).toBe(dto);
      expect(shouldCacheUserProfileDto('50-zh_TW', dto)).toBe(true);

      clearUserProfileDtoCache(50, 'zh_TW');
    });
  });

  describe('resolveUserProfileDtoFetch', () => {
    it('retains primed DTO during optimistic transition window when incoming DTO has not converged', async () => {
      const primedDto = fromPartial<MentorProfileVO>({
        user_id: 60,
        name: 'Optimistic Name',
        job_title: 'Staff Engineer',
        company: 'New Corp',
        is_mentor: true,
      });
      const staleIncomingDto = fromPartial<MentorProfileVO>({
        user_id: 60,
        name: 'Stale Name',
        job_title: 'Junior Engineer',
        company: 'Old Corp',
        is_mentor: false,
      });
      const convergedIncomingDto = fromPartial<MentorProfileVO>({
        user_id: 60,
        name: 'Optimistic Name',
        job_title: 'Staff Engineer',
        company: 'New Corp',
        is_mentor: true,
      });

      primeUserProfileDtoCache(60, 'zh_TW', primedDto);
      expect(isOptimisticTransitionActive()).toBe(true);

      const nonConvergedResult = await resolveUserProfileDtoFetch(
        '60-zh_TW',
        async () => staleIncomingDto,
        new AbortController().signal
      );
      expect(nonConvergedResult).toBe(primedDto);

      const convergedResult = await resolveUserProfileDtoFetch(
        '60-zh_TW',
        async () => convergedIncomingDto,
        new AbortController().signal
      );
      expect(convergedResult).toBe(convergedIncomingDto);

      clearUserProfileDtoCache(60, 'zh_TW');
    });

    it('retains existing cached DTO when background revalidation resolves null', async () => {
      const existingDto = fromPartial<MentorProfileVO>({
        user_id: 61,
        name: 'Existing Mentor',
      });
      primeUserProfileDtoCache(61, 'zh_TW', existingDto);
      vi.advanceTimersByTime(USER_PROFILE_DTO_CACHE_TTL_MS + 1);

      const result = await resolveUserProfileDtoFetch(
        '61-zh_TW',
        async () => null,
        new AbortController().signal
      );
      expect(result).toBe(existingDto);

      const uncachedNull = await resolveUserProfileDtoFetch(
        '999-zh_TW',
        async () => null,
        new AbortController().signal
      );
      expect(uncachedNull).toBeNull();

      clearUserProfileDtoCache(61, 'zh_TW');
    });

    it('evicts cached entry when manual force: true refetch resolves null or throws', async () => {
      const dto1 = fromPartial<MentorProfileVO>({
        user_id: 62,
        name: 'Deleted Mentor',
      });
      primeUserProfileDtoCache(62, 'zh_TW', dto1);

      const nullResult = await resolveUserProfileDtoFetch(
        '62-zh_TW',
        async () => null,
        new AbortController().signal,
        { force: true }
      );
      expect(nullResult).toBeNull();
      expect(userProfileDtoReadManager.peek('62-zh_TW')).toBeUndefined();
      expect(getUserProfileDtoFromCache(62, 'zh_TW')).toBeNull();

      const dto2 = fromPartial<MentorProfileVO>({
        user_id: 63,
        name: 'Error Mentor',
      });
      primeUserProfileDtoCache(63, 'zh_TW', dto2);

      await expect(
        resolveUserProfileDtoFetch(
          '63-zh_TW',
          async () => {
            throw new Error('Network failure');
          },
          new AbortController().signal,
          { force: true }
        )
      ).rejects.toThrow('Network failure');
      expect(userProfileDtoReadManager.peek('63-zh_TW')).toBeUndefined();
      expect(getUserProfileDtoFromCache(63, 'zh_TW')).toBeNull();

      clearUserProfileDtoCache(62, 'zh_TW');
      clearUserProfileDtoCache(63, 'zh_TW');
    });
  });
});
