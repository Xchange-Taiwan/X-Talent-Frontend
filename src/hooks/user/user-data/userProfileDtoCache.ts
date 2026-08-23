import { AsyncReadManager } from '@/lib/asyncReadManager';
import { createKeyedCache } from '@/lib/createKeyedCache';
import { fetchUserById } from '@/services/profile/user';
import type { MentorProfileVO } from '@/types/user';

export const USER_PROFILE_DTO_CACHE_TTL_MS = 60_000;

const baseCache = createKeyedCache<string, MentorProfileVO | null>({
  ttlMs: USER_PROFILE_DTO_CACHE_TTL_MS,
});

// Wrap the cache to preserve expired/stale entries for Stale-While-Revalidate support.
export const userProfileDtoCache: typeof baseCache = {
  ...baseCache,
  get(key) {
    return baseCache.getWithStatus(key)?.value;
  },
  getWithStatus(key) {
    return baseCache.getWithStatus(key);
  },
  has(key) {
    return baseCache.getWithStatus(key) !== undefined;
  },
};

export const userProfileDtoReadManager = new AsyncReadManager<
  string,
  MentorProfileVO | null
>(userProfileDtoCache);

export function readFromDataCache(
  key: string
): { data: MentorProfileVO | null; isStale: boolean } | undefined {
  const result = userProfileDtoCache.getWithStatus(key);
  if (!result) return undefined;
  return { data: result.value, isStale: result.isStale };
}

/**
 * Removes a user's entry from the in-memory cache so the next call to
 * useUserProfileDto for that user triggers a fresh API fetch. Call this after
 * a successful profile update to prevent any concurrent mount from receiving
 * stale data.
 */
export function clearUserProfileDtoCache(
  userId: number,
  language: string
): void {
  const key = `${userId}-${language}`;
  userProfileDtoCache.delete(key);
}

export function subscribeUserProfileDtoCache(
  userId: number,
  language: string,
  listener: () => void
): () => void {
  const key = `${userId}-${language}`;
  return userProfileDtoCache.subscribe(key, listener);
}

export function getUserProfileDtoFromCache(
  userId: number,
  language: string
): MentorProfileVO | null {
  const cached = readFromDataCache(`${userId}-${language}`);
  return cached ? cached.data : null;
}

let lastPrimedTime = 0;

export const OPTIMISTIC_TRANSITION_WINDOW_MS = 10000;

export function getLastPrimedTime(): number {
  return lastPrimedTime;
}

export function isOptimisticTransitionActive(): boolean {
  return Date.now() - lastPrimedTime < OPTIMISTIC_TRANSITION_WINDOW_MS;
}

/**
 * Writes a known-fresh dto into the in-memory cache so the next consumer of
 * useUserProfileDto for this user renders from cache without an API call.
 * Call this after the caller has already retrieved authoritative data (e.g.
 * pollUntilSynced result post profile-submit) to prime the cache before
 * navigating to a page that reads the same dto.
 */
export function primeUserProfileDtoCache(
  userId: number,
  language: string,
  data: MentorProfileVO
): void {
  const key = `${userId}-${language}`;
  userProfileDtoCache.prime(key, data);
  lastPrimedTime = Date.now();
}

/**
 * Prime the cache only when no fresh entry exists. Used by SSR pages that
 * pass an `initialDto` down to a client container — we want to seed the
 * client cache for first paint, but never overwrite a more authoritative
 * client-side prime (e.g. `useProfileSubmit`'s post-write `firstSyncedFetch`)
 * that landed during the same render cycle. Stale entries (past TTL) are
 * overwritten because the SSR initialDto is by definition fresh.
 */
export function primeUserProfileDtoCacheIfEmpty(
  userId: number,
  language: string,
  data: MentorProfileVO
): void {
  const key = `${userId}-${language}`;
  userProfileDtoCache.prime(key, data, { ifEmpty: true });
}

// Promise-deduped fetch: writes to the data cache on success so subsequent
// readers (including a parallel-mounted hook) see the fresh entry. Concurrent
// callers share the same in-flight promise to avoid duplicate network calls.
export function startFetchUserById(
  userId: number,
  language: string
): Promise<MentorProfileVO | null> {
  const key = `${userId}-${language}`;
  return userProfileDtoCache.fetch(key, () => fetchUserById(userId, language), {
    shouldCache: (data) => data !== null,
  });
}
