import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAsyncRead } from '@/hooks/useAsyncRead';
import {
  createStaleMentorRefetchBudget,
  hasDtoConverged,
  type ProfileFetcher,
  type ProfileReadKey,
  profileReadModel,
  resolveMentorAwareSeed,
  USER_PROFILE_DTO_CACHE_TTL_MS,
} from '@/lib/profile/profileReadModel';
import { normalizePositiveUserId } from '@/lib/profile/userId';
import { fetchUserById } from '@/services/profile/user';
import type { MentorProfileVO } from '@/types/user';

export { hasDtoConverged, USER_PROFILE_DTO_CACHE_TTL_MS };

export type ProfileFetchError = 'USER_NOT_FOUND' | 'FETCH_FAILED' | null;

export interface UseUserProfileDtoResult {
  userDto: MentorProfileVO | null;
  isLoading: boolean;
  error: ProfileFetchError;
  refetch?: () => void;
}

export interface UseUserProfileDtoOptions {
  enabled?: boolean;
  /**
   * The caller already knows this user is a Mentor (e.g. the owner's session
   * says so). A Mentee SSR seed is then discarded and a Mentee DTO from the
   * cache/network triggers one deduped forced refetch via
   * `profileReadModel.reconcileExpectedMentor` (#974 / #981).
   */
  expectedIsMentor?: boolean;
}

/**
 * Shared cache layer for the mentor profile DTO. Both the read-only profile
 * view (useUserData) and the edit form (useProfileEditorSession) consume this
 * hook so navigating between them within the cache TTL avoids duplicate API
 * calls.
 */
export function useUserProfileDto(
  userId: number | string,
  language: string,
  initialData?: MentorProfileVO | null,
  options?: UseUserProfileDtoOptions
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
  const expectedIsMentor = Boolean(options?.expectedIsMentor);
  const activeKey = enabled ? readKey : null;

  const fetchProfile = useCallback<ProfileFetcher>(
    (signal) =>
      fetchTargetId !== null
        ? fetchUserById(fetchTargetId, language, signal)
        : Promise.resolve(null),
    [fetchTargetId, language]
  );

  const {
    data: asyncReadData,
    isLoading,
    error,
    refetch,
  } = useAsyncRead(profileReadModel, activeKey, fetchProfile, {
    initialData: resolveMentorAwareSeed(initialData, expectedIsMentor),
  });

  const [staleMentorBudget] = useState(createStaleMentorRefetchBudget);

  useEffect(() => {
    if (!activeKey || isLoading) return;
    void profileReadModel.reconcileExpectedMentor(
      activeKey,
      asyncReadData,
      expectedIsMentor,
      fetchProfile,
      staleMentorBudget
    );
  }, [
    activeKey,
    asyncReadData,
    expectedIsMentor,
    fetchProfile,
    isLoading,
    staleMentorBudget,
  ]);

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
