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
  const [userDto, setUserDto] = useState<MentorProfileVO | null>(null);
  // Default to loading=true so the very first render (before useEffect runs)
  // does not look like "not loading and no data" to consumers — that gap
  // would flash a "user not found" guard for one frame.
  const [isLoading, setIsLoading] = useState(true);
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
