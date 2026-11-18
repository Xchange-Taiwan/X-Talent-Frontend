import { useMemo } from 'react';

import { useAsyncRead } from '@/hooks/useAsyncRead';
import {
  clearUserProfileDtoCache,
  primeUserProfileDtoCache,
} from '@/lib/cache/userProfileDtoCache';
import {
  hasDtoConverged,
  type ProfileReadKey,
  profileReadModel,
  USER_PROFILE_DTO_CACHE_TTL_MS,
} from '@/lib/profile/profileReadModel';
import { normalizePositiveUserId } from '@/lib/profile/userId';
import { fetchUserById } from '@/services/profile/user';
import type { MentorProfileVO } from '@/types/user';

export {
  clearUserProfileDtoCache,
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
  userId: number | string,
  language: string,
  initialData?: MentorProfileVO | null,
  options?: { enabled?: boolean }
): UseUserProfileDtoResult {
  const canonicalUserId = normalizePositiveUserId(userId);
  const fetchTargetId: number | string | null = canonicalUserId
    ? typeof userId === 'number'
      ? userId
      : canonicalUserId
    : null;
  const readKey = useMemo<ProfileReadKey | null>(
    () =>
      canonicalUserId && language
        ? { userId: canonicalUserId, language }
        : null,
    [canonicalUserId, language]
  );
  const enabled = options?.enabled !== false;
  const activeKey = enabled ? readKey : null;

  const {
    data: asyncReadData,
    isLoading,
    error,
    refetch,
  } = useAsyncRead(
    profileReadModel,
    activeKey,
    (signal) =>
      fetchTargetId !== null
        ? fetchUserById(fetchTargetId, language, signal)
        : Promise.resolve(null),
    {
      initialData,
    }
  );

  const userDto = enabled
    ? asyncReadData
    : readKey
      ? (profileReadModel.peek(readKey) ?? null)
      : null;

  let resolvedError: ProfileFetchError = null;
  if (error && !userDto) {
    resolvedError = 'FETCH_FAILED';
  } else if (!isLoading && !userDto && readKey) {
    resolvedError = 'USER_NOT_FOUND';
  }

  return useMemo(
    () => ({ userDto, isLoading, error: resolvedError, refetch }),
    [userDto, isLoading, resolvedError, refetch]
  );
}
