import { useCallback, useMemo, useState } from 'react';

import { useAsyncRead } from '@/hooks/useAsyncRead';
import {
  clearUserProfileDtoCache,
  getEffectiveInitialDto,
  getLastPrimedTime,
  hasDtoConverged,
  primeUserProfileDtoCache,
  resolveUserProfileDtoFetch,
  shouldCacheUserProfileDto,
  USER_PROFILE_DTO_CACHE_TTL_MS,
  userProfileDtoReadManager,
} from '@/lib/cache/userProfileDtoCache';
import { fetchUserById } from '@/services/profile/user';
import type { MentorProfileVO } from '@/types/user';

export {
  clearUserProfileDtoCache,
  getLastPrimedTime,
  hasDtoConverged,
  primeUserProfileDtoCache,
  USER_PROFILE_DTO_CACHE_TTL_MS,
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
  const [manualRetryCount, setManualRetryCount] = useState(0);
  const key = userId && language ? `${userId}-${language}` : null;
  const effectiveInitialData = getEffectiveInitialDto(key, initialData);
  const bypassKey =
    options?.enabled === false ||
    (effectiveInitialData === null && manualRetryCount === 0)
      ? null
      : key;

  const {
    data: asyncReadData,
    isLoading,
    error,
    refetch: rawRefetch,
  } = useAsyncRead(
    userProfileDtoReadManager,
    bypassKey,
    (signal, context) =>
      resolveUserProfileDtoFetch(
        key,
        (s) => fetchUserById(userId, language, s),
        signal,
        context
      ),
    {
      initialData: effectiveInitialData,
      shouldCache: (res) => shouldCacheUserProfileDto(key, res),
    }
  );

  const refetch = useCallback(() => {
    setManualRetryCount((c) => c + 1);
    rawRefetch();
  }, [rawRefetch]);

  const cachedData = key ? userProfileDtoReadManager.peek(key) : null;
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
