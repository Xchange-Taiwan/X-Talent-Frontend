'use client';

import { useCallback, useRef, useSyncExternalStore } from 'react';

import {
  getUserProfileDtoFromCache,
  isOptimisticTransitionActive,
  subscribeTransition,
  subscribeUserProfileDtoCache,
} from '@/hooks/user/user-data/userProfileDtoCache';
import {
  optimisticIdentityFromDto,
  type OptimisticIdentityProjection,
} from '@/lib/identity/identityProjection';
import type { MentorProfileVO } from '@/types/user';

export type { OptimisticIdentityProjection };

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

    const patch = cachedDto ? optimisticIdentityFromDto(cachedDto) : undefined;
    memoRef.current = { cachedDto, isActive, patch };
    return patch;
  }, [userId]);

  return useSyncExternalStore(subscribe, getSnapshot, () => undefined);
}
