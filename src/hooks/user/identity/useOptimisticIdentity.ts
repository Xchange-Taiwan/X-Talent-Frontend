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
import type { MentorProfileVO } from '@/types/user';

interface SnapshotMemo {
  cachedDto: MentorProfileVO | null;
  isActive: boolean;
  patch: IdentityPatch | undefined;
}

/**
 * Reads the optimistically-applied identity patch (see `applyIdentityPatch`
 * in `@/lib/identity/identityProjection`) for `userId`, for as long as that
 * write is inside its optimistic transition window. Returns `undefined` once
 * the window has closed (or nothing was ever primed), signalling callers to
 * fall back to the authoritative, session-derived identity instead.
 *
 * Wraps the profile DTO cache's optimistic-transition mechanism
 * (`userProfileDtoCache.ts`) so consumers - see `useCurrentAvatar` - don't
 * need to know that mechanism exists at all; this hook is the one place
 * that composes it into a single subscription.
 */
export function useOptimisticIdentity(
  userId: number | null
): IdentityPatch | undefined {
  // `useSyncExternalStore` requires `getSnapshot` to return a referentially
  // stable value when nothing actually changed - `identityPatchFromDto`
  // otherwise allocates a fresh object on every call, which reads to
  // React as "changed on every render" and triggers an infinite re-render
  // loop. This memo re-derives the patch only when the underlying cached
  // DTO reference or the transition-active flag actually changes.
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

  const getSnapshot = useCallback((): IdentityPatch | undefined => {
    const isActive = Boolean(userId) && isOptimisticTransitionActive();
    const cachedDto = isActive
      ? (getUserProfileDtoFromCache(userId as number, 'zh_TW') ?? null)
      : null;

    const memo = memoRef.current;
    if (memo.cachedDto === cachedDto && memo.isActive === isActive) {
      return memo.patch;
    }

    const patch = cachedDto ? identityPatchFromDto(cachedDto) : undefined;
    memoRef.current = { cachedDto, isActive, patch };
    return patch;
  }, [userId]);

  return useSyncExternalStore(subscribe, getSnapshot, () => undefined);
}
