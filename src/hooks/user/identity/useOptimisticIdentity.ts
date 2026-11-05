'use client';

import { useCallback, useRef, useSyncExternalStore } from 'react';

import {
  getUserProfileDtoFromCache,
  isOptimisticTransitionActive,
  subscribeTransition,
  subscribeUserProfileDtoCache,
} from '@/hooks/user/user-data/userProfileDtoCache';
import {
  type IdentityPatch,
  identityPatchFromDto,
} from '@/lib/identity/identityProjection';
import {
  decode,
  type MentorExperiencePayload,
} from '@/lib/profile/experienceCodec';
import type { PersonalLink } from '@/types/types';
import type { MentorProfileVO } from '@/types/user';

export interface OptimisticIdentityProjection extends IdentityPatch {
  jobTitle?: string;
  company?: string;
  personalLinks?: PersonalLink[];
}

interface SnapshotMemo {
  cachedDto: MentorProfileVO | null;
  isActive: boolean;
  patch: OptimisticIdentityProjection | undefined;
}

/**
 * Reads the optimistically-applied identity patch (see `applyIdentityPatch`
 * in `@/lib/identity/identityProjection`) for `userId`, for as long as that
 * write is inside its optimistic transition window. Returns `undefined` once
 * the window has closed (or nothing was ever primed), signalling callers to
 * fall back to the authoritative, session-derived identity instead.
 */
export function useOptimisticIdentity(
  userId: number | null
): OptimisticIdentityProjection | undefined {
  const memoRef = useRef<SnapshotMemo>({
    cachedDto: null,
    isActive: false,
    patch: undefined,
  });

  const subscribe = useCallback(
    (listener: () => void) => {
      if (!userId) return () => {};
      const unsubscribeCache = subscribeUserProfileDtoCache(
        userId,
        'zh_TW',
        listener
      );
      const unsubscribeTransition = subscribeTransition(listener);
      return () => {
        unsubscribeCache();
        unsubscribeTransition();
      };
    },
    [userId]
  );

  const getSnapshot = useCallback(():
    OptimisticIdentityProjection | undefined => {
    const isActive = Boolean(userId) && isOptimisticTransitionActive();
    const cachedDto = isActive
      ? (getUserProfileDtoFromCache(userId as number, 'zh_TW') ?? null)
      : null;

    const memo = memoRef.current;
    if (memo.cachedDto === cachedDto && memo.isActive === isActive) {
      return memo.patch;
    }

    let patch: OptimisticIdentityProjection | undefined;
    if (cachedDto) {
      const basePatch = identityPatchFromDto(cachedDto);
      const rawExperiences = Array.isArray(cachedDto.experiences)
        ? (cachedDto.experiences as unknown as MentorExperiencePayload[])
        : [];
      const parsedExp = decode(rawExperiences);
      patch = {
        ...basePatch,
        jobTitle: cachedDto.job_title ?? undefined,
        company: cachedDto.company ?? undefined,
        personalLinks: parsedExp.personalLinks,
      };
    }

    memoRef.current = { cachedDto, isActive, patch };
    return patch;
  }, [userId]);

  return useSyncExternalStore(subscribe, getSnapshot, () => undefined);
}
