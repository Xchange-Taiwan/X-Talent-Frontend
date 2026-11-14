import { AsyncReadManager } from '@/lib/asyncReadManager';
import type { MentorProfileVO } from '@/types/user';

export const USER_PROFILE_DTO_CACHE_TTL_MS = 60_000;

export const userProfileDtoReadManager = new AsyncReadManager<
  string,
  MentorProfileVO | null
>({
  ttlMs: USER_PROFILE_DTO_CACHE_TTL_MS,
});

let lastPrimedTime = 0;
let transitionTimer: ReturnType<typeof setTimeout> | null = null;
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
  userProfileDtoReadManager.invalidate(key);
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
  return userProfileDtoReadManager.observe(key, listener);
}

export function getUserProfileDtoFromCache(
  userId: number,
  language: string
): MentorProfileVO | null {
  return userProfileDtoReadManager.peek(`${userId}-${language}`) ?? null;
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
 * when a client-side cache entry (fresh or stale) already exists for `key`.
 */
export function getEffectiveInitialDto(
  key: string | null,
  initialData?: MentorProfileVO | null
): MentorProfileVO | null | undefined {
  const hasCache = key
    ? userProfileDtoReadManager.getSnapshot(key) !== undefined
    : false;
  return hasCache ? undefined : initialData;
}

/**
 * Guard predicate for `useAsyncRead` `shouldCache`: only cache non-null DTOs
 * whose reference differs from a non-expired cached entry or newly refreshes
 * an expired entry.
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
      const existing = userProfileDtoReadManager.peek(key);
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
      const existing = userProfileDtoReadManager.peek(key);
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
 * This overwrites unconditionally and cancels any competing in-flight read.
 */
export function primeUserProfileDtoCache(
  userId: number,
  language: string,
  data: MentorProfileVO
): void {
  const key = `${userId}-${language}`;
  userProfileDtoReadManager.prime(key, data);
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
