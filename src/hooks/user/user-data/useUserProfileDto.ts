import { useMemo } from 'react';

import { useAsyncRead } from '@/hooks/useAsyncRead';
import { fetchUserById } from '@/services/profile/user';
import type { MentorProfileVO } from '@/types/user';

import {
  clearUserProfileDtoCache,
  getLastPrimedTime,
  getUserProfileDtoFromCache,
  isOptimisticTransitionActive,
  OPTIMISTIC_TRANSITION_WINDOW_MS,
  primeUserProfileDtoCache,
  primeUserProfileDtoCacheIfEmpty,
  subscribeTransition,
  subscribeUserProfileDtoCache,
  USER_PROFILE_DTO_CACHE_TTL_MS,
  userProfileDtoCache,
  userProfileDtoReadManager,
} from './userProfileDtoCache';

export {
  clearUserProfileDtoCache,
  getLastPrimedTime,
  getUserProfileDtoFromCache,
  isOptimisticTransitionActive,
  OPTIMISTIC_TRANSITION_WINDOW_MS,
  primeUserProfileDtoCache,
  primeUserProfileDtoCacheIfEmpty,
  subscribeTransition,
  subscribeUserProfileDtoCache,
  USER_PROFILE_DTO_CACHE_TTL_MS,
  userProfileDtoCache,
  userProfileDtoReadManager,
};

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
  initialData?: MentorProfileVO | null,
  options?: { enabled?: boolean }
): UseUserProfileDtoResult {
  const key = userId && language ? `${userId}-${language}` : null;

  // If we already have a client-side primed cache entry, do NOT pass initialData to useAsyncRead
  // to prevent it from being overwritten by the stale/older SSR initialData.
  const hasCache = key ? userProfileDtoReadManager.has(key) : false;
  const effectiveInitialData = hasCache ? undefined : initialData;

  const bypassKey = options?.enabled === false ? null : key;

  const {
    data: asyncReadData,
    isLoading,
    error,
    refetch,
  } = useAsyncRead(
    userProfileDtoReadManager,
    bypassKey,
    async (signal, context) => {
      const isManualRefetch = !!context?.force;
      try {
        const res = await fetchUserById(userId, language, signal);

        if (res === null && key) {
          if (isManualRefetch) {
            userProfileDtoReadManager.evict(key);
            return null;
          }
          const existing = userProfileDtoReadManager.get(key);
          if (existing) {
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
    },
    {
      initialData: effectiveInitialData,
      shouldCache: (res) =>
        res !== null && (!key || res !== userProfileDtoReadManager.get(key)),
    }
  );

  const cachedData = key ? userProfileDtoReadManager.get(key) : null;
  const userDto =
    options?.enabled === false ? (cachedData ?? null) : asyncReadData;

  // Map errors and handle "USER_NOT_FOUND" distinction
  let resolvedError: ProfileFetchError = null;
  if (error && !userDto) {
    resolvedError = 'FETCH_FAILED';
  } else if (!isLoading && !userDto && key) {
    resolvedError = 'USER_NOT_FOUND';
  }

  return useMemo(
    () => ({ userDto, isLoading, error: resolvedError, refetch }),
    [userDto, isLoading, resolvedError, refetch]
  );
}
