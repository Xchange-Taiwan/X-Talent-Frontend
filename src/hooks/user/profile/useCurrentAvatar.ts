'use client';

import { useSession } from 'next-auth/react';
import { useCallback, useSyncExternalStore } from 'react';

import { useIdentity } from '@/hooks/user/auth/useIdentity';
import {
  getOptimisticAvatar,
  subscribeToOptimisticAvatar,
} from '@/lib/profile/optimisticAvatar';

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
  const { data: session } = useSession();
  const sessionUserId = session?.user?.id ?? null;
  const pageUserIdNumber = sessionUserId ? Number(sessionUserId) : null;
  const validUserId =
    pageUserIdNumber && !Number.isNaN(pageUserIdNumber) ? pageUserIdNumber : 0;

  const identity = useIdentity();

  const getSnapshot = useCallback(() => {
    return getOptimisticAvatar(validUserId);
  }, [validUserId]);

  const optimisticAvatar = useSyncExternalStore(
    subscribeToOptimisticAvatar,
    getSnapshot,
    () => null
  );

  // During the active transition period after an optimistic update, prioritize the optimistic avatar.
  // Otherwise, prioritize the session's identity avatar (authoritative).
  if (optimisticAvatar) {
    return optimisticAvatar;
  }

  return identity.avatar ?? null;
}
