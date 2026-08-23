'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { useResolvedIdentity } from '@/hooks/user/auth/useResolvedIdentity';
import {
  getLastPrimedTime,
  getUserProfileDtoFromCache,
  isOptimisticTransitionActive,
  OPTIMISTIC_TRANSITION_WINDOW_MS,
  subscribeUserProfileDtoCache,
} from '@/hooks/user/user-data/useUserProfileDto';

/**
 * Returns the avatar URL to render for the currently signed-in user.
 *
 * Reads from the client-side user DTO cache layer (set synchronously on a successful
 * profile submit via saveProfile) and falls back to the resolved identity avatar
 * (which handles the session hint cookie).
 * Bridges the gap left by NextAuth v4's `update()` round-trip — without it
 * the header shows the old avatar between submit and the session refetch landing.
 */
export function useCurrentAvatar(): string | null {
  const identity = useResolvedIdentity();
  const userIdStr = identity.userId;
  const validUserId = Number(userIdStr) || 0;

  const [, forceUpdate] = useState(0);

  const getSnapshot = useCallback(() => {
    if (!validUserId) return undefined;
    const cachedDto = getUserProfileDtoFromCache(validUserId, 'zh_TW');
    if (!cachedDto) return undefined;
    return cachedDto.avatar ?? null;
  }, [validUserId]);

  const optimisticAvatar = useSyncExternalStore(
    useCallback(
      (listener) => {
        if (!validUserId) return () => {};
        return subscribeUserProfileDtoCache(validUserId, 'zh_TW', listener);
      },
      [validUserId]
    ),
    getSnapshot,
    () => null
  );

  const lastPrimed = getLastPrimedTime();
  const isTransitioning = isOptimisticTransitionActive();

  useEffect(() => {
    if (!isTransitioning || lastPrimed === 0) return;

    const remainingTime =
      OPTIMISTIC_TRANSITION_WINDOW_MS - (Date.now() - lastPrimed);
    if (remainingTime <= 0) return;

    const timer = setTimeout(() => {
      forceUpdate((prev) => prev + 1);
    }, remainingTime);

    return () => clearTimeout(timer);
  }, [lastPrimed, isTransitioning]);

  // During the active transition period after an optimistic update, prioritize the optimistic avatar.
  // Otherwise, prioritize the session's identity avatar (authoritative).
  if (optimisticAvatar !== undefined && isTransitioning) {
    return optimisticAvatar;
  }

  return identity.avatar ?? null;
}
