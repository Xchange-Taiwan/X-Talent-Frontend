import { useCallback, useRef, useState } from 'react';

import { useAsyncRead } from '@/hooks/useAsyncRead';
import { AsyncReadManager } from '@/lib/asyncReadManager';
import { createKeyedCache } from '@/lib/createKeyedCache';
import { fetchUserById } from '@/services/profile/user';
import type { MentorProfileVO } from '@/types/user';

export const USER_PROFILE_DTO_CACHE_TTL_MS = 60_000;

const baseCache = createKeyedCache<string, MentorProfileVO | null>({
  ttlMs: USER_PROFILE_DTO_CACHE_TTL_MS,
});

function stripTrigger(key: string): string {
  return key.split('?')[0];
}

// Wrap the cache to strip the cache-busting query parameter and preserve expired/stale entries for Stale-While-Revalidate support
export const userProfileDtoCache: typeof baseCache = {
  ...baseCache,
  get(key) {
    return baseCache.getWithStatus(stripTrigger(key))?.value;
  },
  getWithStatus(key) {
    return baseCache.getWithStatus(stripTrigger(key));
  },
  set(key, value, ttlMs) {
    // If value is null, do NOT cache it! (matches `shouldCache: (data) => data !== null` constraint)
    if (value !== null) {
      baseCache.set(stripTrigger(key), value, ttlMs);
    }
  },
  has(key) {
    return baseCache.getWithStatus(stripTrigger(key)) !== undefined;
  },
  delete(key) {
    baseCache.delete(stripTrigger(key));
  },
  prime(key, value, options) {
    if (value !== null) {
      baseCache.prime(stripTrigger(key), value, options);
    }
  },
};

export const userProfileDtoReadManager = new AsyncReadManager<
  string,
  MentorProfileVO | null
>(userProfileDtoCache);

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

  const cleanKey = userId && language ? `${userId}-${language}` : null;
  const key =
    userId && language ? `${userId}-${language}?t=${retryTrigger}` : null;

  // Seed the cache immediately during render if initialData is provided.
  // This ensures synchronous first paint without flash or skeleton.
  if (initialDataRef.current !== undefined && cleanKey) {
    userProfileDtoCache.set(cleanKey, initialDataRef.current);
    initialDataRef.current = undefined;
  }

  const refetch = useCallback(() => {
    if (cleanKey) {
      userProfileDtoCache.delete(cleanKey);
    }
    setRetryTrigger((prev) => prev + 1);
  }, [cleanKey]);

  const {
    data: userDto,
    isLoading,
    error,
  } = useAsyncRead(userProfileDtoReadManager, key, async (signal) => {
    const res = await fetchUserById(userId, language, signal);
    if (res === null && key) {
      // If it's a background revalidation (meaning we already have stale data),
      // we keep the stale data as per "background revalidation returning null keeps stale data"
      const existing = userProfileDtoCache.get(key);
      if (existing) {
        return existing;
      }
    }
    return res;
  });

  // Map errors and handle "USER_NOT_FOUND" distinction
  let resolvedError: ProfileFetchError = null;
  if (error && !userDto) {
    resolvedError = 'FETCH_FAILED';
  } else if (!isLoading && !userDto && key) {
    resolvedError = 'USER_NOT_FOUND';
  }

  return { userDto, isLoading, error: resolvedError, refetch };
}
