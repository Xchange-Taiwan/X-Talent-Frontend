import { useEffect, useState } from 'react';

import { fetchUserById, MentorProfileVO } from '@/services/profile/user';

export const USER_PROFILE_DTO_CACHE_TTL_MS = 60_000;

interface CachedUserDtoEntry {
  data: MentorProfileVO;
  expiresAt: number;
}

interface CachedReadResult {
  data: MentorProfileVO;
  isStale: boolean;
}

const userDtoDataCache = new Map<string, CachedUserDtoEntry>();
const userDtoPromiseCache = new Map<string, Promise<MentorProfileVO | null>>();

function readFromDataCache(key: string): CachedReadResult | undefined {
  const entry = userDtoDataCache.get(key);
  if (!entry) return undefined;
  return { data: entry.data, isStale: entry.expiresAt <= Date.now() };
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
  userDtoDataCache.delete(key);
  userDtoPromiseCache.delete(key);
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
  userDtoDataCache.set(key, {
    data,
    expiresAt: Date.now() + USER_PROFILE_DTO_CACHE_TTL_MS,
  });
  // Drop any in-flight promise for this key so future readers see the primed
  // entry instead of awaiting an older fetch that is about to be superseded.
  userDtoPromiseCache.delete(key);
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
  const existing = userDtoDataCache.get(key);
  if (existing && existing.expiresAt > Date.now()) return;
  userDtoDataCache.set(key, {
    data,
    expiresAt: Date.now() + USER_PROFILE_DTO_CACHE_TTL_MS,
  });
  userDtoPromiseCache.delete(key);
}

// Promise-deduped fetch: writes to the data cache on success so subsequent
// readers (including a parallel-mounted hook) see the fresh entry. Concurrent
// callers share the same in-flight promise to avoid duplicate network calls.
function startFetchUserById(
  userId: number,
  language: string
): Promise<MentorProfileVO | null> {
  const key = `${userId}-${language}`;

  const inflight = userDtoPromiseCache.get(key);
  if (inflight) return inflight;

  const promise = fetchUserById(userId, language)
    .then((data) => {
      if (data) {
        userDtoDataCache.set(key, {
          data,
          expiresAt: Date.now() + USER_PROFILE_DTO_CACHE_TTL_MS,
        });
      }
      return data;
    })
    .finally(() => {
      userDtoPromiseCache.delete(key);
    });
  userDtoPromiseCache.set(key, promise);
  return promise;
}

export interface UseUserProfileDtoResult {
  userDto: MentorProfileVO | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Shared cache layer for the mentor profile DTO. Both the read-only profile
 * view (useUserData) and the edit form (useEditProfileData) consume this hook
 * so navigating between them within the cache TTL avoids duplicate API calls.
 */
export function useUserProfileDto(
  userId: number,
  language: string
): UseUserProfileDtoResult {
  // Lazy-init from cache so SSR-primed data lands in state on the first
  // render — avoids a one-frame loading flash before useEffect's cache read
  // catches up. When the cache is empty the hook still defaults to
  // loading=true so consumers' "user not found" guard does not flash.
  const [userDto, setUserDto] = useState<MentorProfileVO | null>(() => {
    const isUserIdValid = Boolean(userId) && !Number.isNaN(userId);
    if (!isUserIdValid || !language) return null;
    return readFromDataCache(`${userId}-${language}`)?.data ?? null;
  });
  const [isLoading, setIsLoading] = useState(() => {
    const isUserIdValid = Boolean(userId) && !Number.isNaN(userId);
    if (!isUserIdValid || !language) return false;
    return !readFromDataCache(`${userId}-${language}`);
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const isUserIdValid = Boolean(userId) && !Number.isNaN(userId);
    const isLanguageValid = Boolean(language);

    if (!isUserIdValid || !isLanguageValid) {
      setUserDto(null);
      setError(null);
      setIsLoading(false);
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
          setError('User not found');
          return;
        }
        setUserDto(data);
        setError(null);
      })
      .catch((e) => {
        console.error('Failed to load user profile dto:', e);
        if (cancelled) return;
        setUserDto(null);
        setError('Failed to load user data');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, language]);

  return { userDto, isLoading, error };
}
