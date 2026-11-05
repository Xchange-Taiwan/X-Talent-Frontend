import { AsyncReadManager } from '@/lib/asyncReadManager';
import { createKeyedCache } from '@/lib/createKeyedCache';
import type { MentorProfileVO } from '@/types/user';

export const USER_PROFILE_DTO_CACHE_TTL_MS = 60_000;

const baseCache = createKeyedCache<string, MentorProfileVO | null>({
  ttlMs: USER_PROFILE_DTO_CACHE_TTL_MS,
});

// Wrap the cache to preserve expired/stale entries for Stale-While-Revalidate support.
const userProfileDtoCache: typeof baseCache = {
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

function readFromDataCache(
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
  lastPrimedTime = 0;
  if (transitionTimer) {
    clearTimeout(transitionTimer);
    transitionTimer = null;
  }
  notifyTransitionListeners();
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
let transitionTimer: NodeJS.Timeout | null = null;
const transitionListeners = new Set<() => void>();

const OPTIMISTIC_TRANSITION_WINDOW_MS = 10000;

export function subscribeTransition(listener: () => void): () => void {
  transitionListeners.add(listener);
  return () => {
    transitionListeners.delete(listener);
  };
}

function notifyTransitionListeners(): void {
  transitionListeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('Error in transition listener:', e);
    }
  });
}

export function getLastPrimedTime(): number {
  return lastPrimedTime;
}

export function isOptimisticTransitionActive(): boolean {
  return Date.now() - lastPrimedTime < OPTIMISTIC_TRANSITION_WINDOW_MS;
}

/**
 * Checks whether an incoming backend DTO has caught up with a client-primed
 * optimistic DTO during the post-save transition window.
 */
export function hasDtoConverged(
  primed: MentorProfileVO,
  incoming: MentorProfileVO
): boolean {
  const avatarConverged =
    primed.avatar === undefined
      ? true
      : !primed.avatar
        ? !incoming.avatar
        : typeof incoming.avatar === 'string' &&
          incoming.avatar.startsWith(primed.avatar);

  const experiencesConverged =
    primed.experiences === undefined ||
    JSON.stringify(incoming.experiences ?? null) ===
      JSON.stringify(primed.experiences ?? null);

  return (
    (incoming.name ?? null) === (primed.name ?? null) &&
    Boolean(incoming.is_mentor) === Boolean(primed.is_mentor) &&
    Boolean(incoming.onboarding) === Boolean(primed.onboarding) &&
    (incoming.job_title ?? null) === (primed.job_title ?? null) &&
    (incoming.company ?? null) === (primed.company ?? null) &&
    avatarConverged &&
    experiencesConverged
  );
}

/**
 * Resolves effective initialData for SSR hydration: skips stale SSR initialData
 * when a client-side cache entry already exists for `key`.
 */
export function getEffectiveInitialDto(
  key: string | null,
  initialData?: MentorProfileVO | null
): MentorProfileVO | null | undefined {
  const hasCache = key ? userProfileDtoReadManager.has(key) : false;
  return hasCache ? undefined : initialData;
}

/**
 * Guard predicate for `useAsyncRead` `shouldCache`: only cache non-null DTOs
 * whose reference differs from what is already stored.
 */
export function shouldCacheUserProfileDto(
  key: string | null,
  res: MentorProfileVO | null
): boolean {
  return res !== null && (!key || res !== userProfileDtoReadManager.get(key));
}

/**
 * Encapsulates SWR fetch resolution, null/error eviction on manual refetch,
 * and `hasDtoConverged` protection for primed optimistic DTOs during background
 * revalidation.
 */
export async function resolveUserProfileDtoFetch(
  key: string | null,
  fetcher: (signal: AbortSignal) => Promise<MentorProfileVO | null>,
  signal: AbortSignal,
  context?: { force?: boolean }
): Promise<MentorProfileVO | null> {
  const isManualRefetch = !!context?.force;
  try {
    const res = await fetcher(signal);

    if (res === null && key) {
      if (isManualRefetch) {
        userProfileDtoReadManager.evict(key);
        return null;
      }
      const existing = userProfileDtoReadManager.get(key);
      if (existing) {
        return existing;
      }
      return null;
    }

    if (
      res !== null &&
      key &&
      !isManualRefetch &&
      isOptimisticTransitionActive()
    ) {
      const existing = userProfileDtoReadManager.get(key);
      if (existing && !hasDtoConverged(existing, res)) {
        return existing;
      }
    }

    return res;
  } catch (err) {
    if (isManualRefetch && key) {
      userProfileDtoReadManager.evict(key);
    }
    throw err;
  }
}

/**
 * Writes a known-fresh dto into the in-memory cache so the next consumer of
 * useUserProfileDto for this user renders from cache without an API call.
 * Call this after the caller has already retrieved authoritative data (e.g.
 * pollUntilSynced result post profile-submit) to prime the cache before
 * navigating to a page that reads the same dto.
 *
 * This overwrites unconditionally. SSR-injected `initialData` does NOT go
 * through here - `useUserProfileDto`'s own `hasCache` check is what stops a
 * stale SSR payload from clobbering a fresher client-primed entry, by simply
 * not passing `initialData` through when a cache entry already exists.
 */
export function primeUserProfileDtoCache(
  userId: number,
  language: string,
  data: MentorProfileVO
): void {
  const key = `${userId}-${language}`;
  userProfileDtoCache.prime(key, data);
  lastPrimedTime = Date.now();

  if (transitionTimer) {
    clearTimeout(transitionTimer);
  }
  transitionTimer = setTimeout(() => {
    transitionTimer = null;
    notifyTransitionListeners();
  }, OPTIMISTIC_TRANSITION_WINDOW_MS);

  notifyTransitionListeners();
}
