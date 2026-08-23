import { useCallback, useEffect, useRef, useState } from 'react';

import type { MentorProfileVO } from '@/types/user';

import {
  readFromDataCache,
  startFetchUserById,
  subscribeUserProfileDtoCache,
  userProfileDtoCache,
} from './userProfileDtoCache';

export {
  clearUserProfileDtoCache,
  getLastPrimedTime,
  getUserProfileDtoFromCache,
  primeUserProfileDtoCache,
  primeUserProfileDtoCacheIfEmpty,
  subscribeUserProfileDtoCache,
  USER_PROFILE_DTO_CACHE_TTL_MS,
} from './userProfileDtoCache';

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
  initialData?: MentorProfileVO | null,
  options?: { enabled?: boolean }
): UseUserProfileDtoResult {
  const [retryTrigger, setRetryTrigger] = useState(0);
  const initialDataRef = useRef<MentorProfileVO | undefined>(
    initialData ?? undefined
  );

  // Lazy-init from cache first, then fall back to initialData, so SSR-primed
  // data lands in state on the first render — avoids a one-frame loading flash
  // before useEffect's cache read/initialData-consume catches up. If there is a
  // fresh/authoritative client-side prime (e.g. from saveProfile), we prefer
  // that over initialData.
  const [userDto, setUserDto] = useState<MentorProfileVO | null>(() => {
    const isUserIdValid = Boolean(userId) && !Number.isNaN(userId);
    if (isUserIdValid && language) {
      const cached = readFromDataCache(`${userId}-${language}`);
      if (cached) {
        return cached.data;
      }
    }
    if (initialDataRef.current !== undefined) return initialDataRef.current;
    return null;
  });
  const [isLoading, setIsLoading] = useState(() => {
    if (options?.enabled === false) return false;
    const isUserIdValid = Boolean(userId) && !Number.isNaN(userId);
    if (isUserIdValid && language) {
      const cached = readFromDataCache(`${userId}-${language}`);
      if (cached) {
        return false;
      }
    }
    if (initialDataRef.current !== undefined) return false;
    if (!isUserIdValid || !language) return false;
    return true;
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

    if (options?.enabled === false) {
      if (isUserIdValid && isLanguageValid) {
        const cachedEntry = readFromDataCache(`${userId}-${language}`);
        if (cachedEntry) {
          setUserDto(cachedEntry.data);
        } else {
          setUserDto(null);
        }
      } else {
        setUserDto(null);
      }
      setIsLoading(false);
      setError(null);
      return;
    }

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
      userProfileDtoCache.prime(`${userId}-${language}`, seeded, {
        ifEmpty: true,
      });
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
  }, [userId, language, retryTrigger, options?.enabled]);

  useEffect(() => {
    const isUserIdValid = Boolean(userId) && !Number.isNaN(userId);
    const isLanguageValid = Boolean(language);
    if (!isUserIdValid || !isLanguageValid) return;

    return subscribeUserProfileDtoCache(userId, language, () => {
      const cached = readFromDataCache(`${userId}-${language}`);
      if (cached) {
        setUserDto(cached.data);
        setIsLoading(false);
      }
    });
  }, [userId, language]);

  return { userDto, isLoading, error, refetch };
}
