import { describe, expect, it } from 'vitest';

import * as cacheModule from '@/lib/cache/userProfileDtoCache';

import * as hookReExports from './userProfileDtoCache';

describe('userProfileDtoCache hook-layer re-export', () => {
  it('re-exports the identical module surface from @/lib/cache/userProfileDtoCache', () => {
    expect(hookReExports.userProfileDtoReadManager).toBe(
      cacheModule.userProfileDtoReadManager
    );
    expect(hookReExports.primeUserProfileDtoCache).toBe(
      cacheModule.primeUserProfileDtoCache
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
  });
});
