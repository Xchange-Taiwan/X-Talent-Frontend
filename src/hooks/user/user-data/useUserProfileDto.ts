import { useCallback, useEffect, useRef, useState } from 'react';

import { createKeyedCache } from '@/lib/createKeyedCache';
import { fetchUserById } from '@/services/profile/user';
import type { MentorProfileVO } from '@/types/user';

export const USER_PROFILE_DTO_CACHE_TTL_MS = 60_000;

const userProfileDtoCache = createKeyedCache<string, MentorProfileVO | null>({
  ttlMs: USER_PROFILE_DTO_CACHE_TTL_MS,
});

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
function startFetchUserById(
  userId: number,
  language: string
): Promise<MentorProfileVO | null> {
  const key = `${userId}-${language}`;
  return userProfileDtoCache.fetch(key, () => fetchUserById(userId, language), {
    shouldCache: (data) => data !== null,
  });
}

export type ProfileFetchError = 'USER_NOT_FOUND' | 'FETCH_FAILED' | null;

export interface UseUserProfileDtoResult {
  userDto: MentorProfileVO | null;
  isLoading: boolean;
  error: ProfileFetchError;
  refetch?: () => void;
}

/**
 * Shared cache layer for the mentor profile DTO. Both the read-only profile
 * view (useUserData) and the edit form (useEditProfileData) consume this hook
 * so navigating between them within the cache TTL avoids duplicate API calls.
 *
 * `initialData` (optional) lets a caller that already SSR-fetched the DTO
 * seed state directly - a real object skips the fetch entirely, `null` (SSR
 * fetch failed) falls through to the normal cache-check/fetch path exactly
 * as if `initialData` had never been passed. Deliberately does NOT write
 * into the shared, process-wide `userProfileDtoCache` during this initial
 * render: that would run during a server component's SSR render pass too
 * (mutating module state shared across concurrent Node requests). The cache
 * write is deferred to the mount effect below instead, which never runs
 * during SSR.
 */
export function useUserProfileDto(
  userId: number,
  language: string,
  initialData?: MentorProfileVO | null
): UseUserProfileDtoResult {
  const [retryTrigger, setRetryTrigger] = useState(0);
  const initialDataRef = useRef<MentorProfileVO | undefined>(
    initialData ?? undefined
  );

  // Lazy-init from initialData, then cache, so SSR-primed data lands in
  // state on the first render — avoids a one-frame loading flash before
  // useEffect's cache read/initialData-consume catches up. When neither is
  // available the hook still defaults to loading=true so consumers' "user
  // not found" guard does not flash.
  const [userDto, setUserDto] = useState<MentorProfileVO | null>(() => {
    if (initialDataRef.current !== undefined) return initialDataRef.current;
    const isUserIdValid = Boolean(userId) && !Number.isNaN(userId);
    if (!isUserIdValid || !language) return null;
    return readFromDataCache(`${userId}-${language}`)?.data ?? null;
  });
  const [isLoading, setIsLoading] = useState(() => {
    if (initialDataRef.current !== undefined) return false;
    const isUserIdValid = Boolean(userId) && !Number.isNaN(userId);
    if (!isUserIdValid || !language) return false;
    return !readFromDataCache(`${userId}-${language}`);
  });
  const [error, setError] = useState<ProfileFetchError>(null);

  const refetch = useCallback(() => {
    const key = `${userId}-${language}`;
    userProfileDtoCache.delete(key);
    setError(null);
    setIsLoading(true);
    setRetryTrigger((prev) => prev + 1);
  }, [userId, language]);

  useEffect(() => {
    const isUserIdValid = Boolean(userId) && !Number.isNaN(userId);
    const isLanguageValid = Boolean(language);

    if (!isUserIdValid || !isLanguageValid) {
      setUserDto(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    // Client-only: warm the shared cache from the SSR-supplied initialData
    // so a later mount/navigation for the same key hits the cache instead
    // of re-fetching. See the doc comment above for why this can't happen
    // during the lazy useState initializers above.
    if (initialDataRef.current !== undefined) {
      const seeded = initialDataRef.current;
      initialDataRef.current = undefined;
      userProfileDtoCache.set(`${userId}-${language}`, seeded);
      return;
    }

    let cancelled = false;
    const key = `${userId}-${language}`;
    const cachedEntry = readFromDataCache(key);

    // Cached path: render immediately from cache, then optionally
    // revalidate in the background. Only a missing cache entry triggers
    // a blocking load.
    if (cachedEntry) {
      setUserDto(cachedEntry.data);
      setError(null);
      setIsLoading(false);

      if (cachedEntry.isStale) {
        startFetchUserById(userId, language)
          .then((data) => {
            if (cancelled || !data) return;
            setUserDto(data);
          })
          .catch((e) => {
            // Background revalidation failure: keep showing stale data,
            // surface only via console (no error state flip).
            console.error('Background user-profile-dto refetch failed:', e);
          });
      }

      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    setError(null);

    startFetchUserById(userId, language)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setUserDto(null);
          setError('USER_NOT_FOUND');
          return;
        }
        setUserDto(data);
        setError(null);
      })
      .catch((e) => {
        console.error('Failed to load user profile dto:', e);
        if (cancelled) return;
        setUserDto(null);
        setError('FETCH_FAILED');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, language, retryTrigger]);

  return { userDto, isLoading, error, refetch };
}
