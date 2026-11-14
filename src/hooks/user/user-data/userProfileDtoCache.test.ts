import { describe, expect, it } from 'vitest';

import * as cacheModule from '@/lib/cache/userProfileDtoCache';

import * as hookReExports from './userProfileDtoCache';

describe('userProfileDtoCache hook-layer re-export', () => {
  it('re-exports the identical module surface from @/lib/cache/userProfileDtoCache', () => {
    expect(Object.keys(hookReExports).sort()).toEqual(
      Object.keys(cacheModule).sort()
    );
    expect(hookReExports.USER_PROFILE_DTO_CACHE_TTL_MS).toBe(
      cacheModule.USER_PROFILE_DTO_CACHE_TTL_MS
    );
    expect(hookReExports.userProfileDtoReadManager).toBe(
      cacheModule.userProfileDtoReadManager
    );
    expect(hookReExports.subscribeTransition).toBe(
      cacheModule.subscribeTransition
    );
    expect(hookReExports.getLastPrimedTime).toBe(cacheModule.getLastPrimedTime);
    expect(hookReExports.isOptimisticTransitionActive).toBe(
      cacheModule.isOptimisticTransitionActive
    );
    expect(hookReExports.clearUserProfileDtoCache).toBe(
      cacheModule.clearUserProfileDtoCache
    );
    expect(hookReExports.subscribeUserProfileDtoCache).toBe(
      cacheModule.subscribeUserProfileDtoCache
    );
    expect(hookReExports.getUserProfileDtoFromCache).toBe(
      cacheModule.getUserProfileDtoFromCache
    );
    expect(hookReExports.hasDtoConverged).toBe(cacheModule.hasDtoConverged);
    expect(hookReExports.getEffectiveInitialDto).toBe(
      cacheModule.getEffectiveInitialDto
    );
    expect(hookReExports.shouldCacheUserProfileDto).toBe(
      cacheModule.shouldCacheUserProfileDto
    );
    expect(hookReExports.resolveUserProfileDtoFetch).toBe(
      cacheModule.resolveUserProfileDtoFetch
    );
    expect(hookReExports.primeUserProfileDtoCache).toBe(
      cacheModule.primeUserProfileDtoCache
    );
  });
});
