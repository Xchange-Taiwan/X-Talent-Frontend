import type {
  AsyncCacheSnapshot,
  AsyncPrimeOptions,
  AsyncReadOptions,
  AsyncReadResult,
  AsyncReadSource,
} from '@/lib/asyncReadManager';
import {
  hasDtoConverged,
  hasProfileDtoConverged,
  parseProfileCacheKey,
  type ProfileFetcher,
  profileReadModel,
  USER_PROFILE_DTO_CACHE_TTL_MS,
} from '@/lib/profile/profileReadModel';
import type { MentorProfileVO } from '@/types/user';

export {
  hasDtoConverged,
  hasProfileDtoConverged,
  USER_PROFILE_DTO_CACHE_TTL_MS,
};

export interface LegacyProfileDtoReadManager extends AsyncReadSource<
  string,
  MentorProfileVO | null
> {
  peek(key: string): MentorProfileVO | null | undefined;
  getSnapshot(
    key: string
  ): AsyncCacheSnapshot<MentorProfileVO | null> | undefined;
  prime(
    key: string,
    value: MentorProfileVO | null,
    options?: AsyncPrimeOptions
  ): void;
  observe(key: string, listener: () => void): () => void;
  evict(key: string): void;
  invalidate(key: string): void;
  clear(): void;
}

/**
 * Thin string-keyed compatibility adapter delegating 100% of state to
 * `profileReadModel`.
 */
export const userProfileDtoReadManager: LegacyProfileDtoReadManager = {
  get(rawKey) {
    const parsed = parseProfileCacheKey(rawKey);
    return parsed ? profileReadModel.get(parsed) : undefined;
  },
  peek(rawKey) {
    const parsed = parseProfileCacheKey(rawKey);
    return parsed ? profileReadModel.peek(parsed) : undefined;
  },
  getSnapshot(rawKey) {
    const parsed = parseProfileCacheKey(rawKey);
    return parsed ? profileReadModel.getSnapshot(parsed) : undefined;
  },
  set(rawKey, value, ttlMs) {
    const parsed = parseProfileCacheKey(rawKey);
    if (parsed) {
      profileReadModel.set(parsed, value, ttlMs);
    }
  },
  prime(rawKey, value, options) {
    const parsed = parseProfileCacheKey(rawKey);
    if (parsed) {
      profileReadModel.prime(parsed, value, options);
    }
  },
  subscribe(
    rawKey: string,
    fetcher: ProfileFetcher,
    onUpdate: (result: AsyncReadResult<MentorProfileVO | null>) => void,
    options?: AsyncReadOptions<MentorProfileVO | null>
  ) {
    const parsed = parseProfileCacheKey(rawKey);
    if (!parsed) {
      return () => {};
    }
    return profileReadModel.subscribe(parsed, fetcher, onUpdate, options);
  },
  observe(rawKey, listener) {
    const parsed = parseProfileCacheKey(rawKey);
    return parsed ? profileReadModel.observe(parsed, listener) : () => {};
  },
  evict(rawKey) {
    const parsed = parseProfileCacheKey(rawKey);
    if (parsed) {
      profileReadModel.evict(parsed);
    }
  },
  invalidate(rawKey) {
    const parsed = parseProfileCacheKey(rawKey);
    if (parsed) {
      profileReadModel.invalidate(parsed);
    }
  },
  clear() {
    profileReadModel.clear();
  },
};

export function subscribeTransition(listener: () => void): () => void {
  return profileReadModel.subscribeTransition(listener);
}

export function getLastPrimedTime(): number {
  return profileReadModel.getLastPrimedTime();
}

export function isOptimisticTransitionActive(): boolean {
  return profileReadModel.isOptimisticTransitionActive();
}

export function clearUserProfileDtoCache(
  userId?: number,
  language?: string
): void {
  if (userId !== undefined && language !== undefined) {
    profileReadModel.invalidate({ userId, language });
  } else if (userId !== undefined) {
    profileReadModel.invalidateUser(userId);
  } else {
    profileReadModel.clear();
  }
}

export function subscribeUserProfileDtoCache(
  userId: number,
  language: string,
  listener: () => void
): () => void {
  return profileReadModel.observe({ userId, language }, listener);
}

export function getUserProfileDtoFromCache(
  userId: number,
  language: string
): MentorProfileVO | null {
  return profileReadModel.peek({ userId, language }) ?? null;
}

export function getEffectiveInitialDto(
  key: string | null,
  initialData?: MentorProfileVO | null
): MentorProfileVO | null | undefined {
  return profileReadModel.resolveInitialData(
    parseProfileCacheKey(key),
    initialData
  );
}

export function shouldCacheUserProfileDto(
  key: string | null,
  res: MentorProfileVO | null
): boolean {
  return profileReadModel.shouldCache(parseProfileCacheKey(key), res);
}

export function resolveUserProfileDtoFetch(
  key: string | null,
  fetcher: (signal: AbortSignal) => Promise<MentorProfileVO | null>,
  signal: AbortSignal,
  context?: { force?: boolean }
): Promise<MentorProfileVO | null> {
  return profileReadModel.resolveFetch(
    parseProfileCacheKey(key),
    fetcher,
    signal,
    context
  );
}

export function primeUserProfileDtoCache(
  userId: number,
  language: string,
  data: MentorProfileVO
): void {
  profileReadModel.prime({ userId, language }, data);
}
