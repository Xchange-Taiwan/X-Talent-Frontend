'use client';

import { useSession } from 'next-auth/react';

import { useIdentity } from '@/hooks/user/auth/useIdentity';
import { useUserProfileDto } from '@/hooks/user/user-data/useUserProfileDto';
import { getOptimisticAvatar } from '@/lib/profile/optimisticAvatar';

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

  const { userDto } = useUserProfileDto(
    pageUserIdNumber && !Number.isNaN(pageUserIdNumber) ? pageUserIdNumber : 0,
    'zh_TW',
    undefined,
    { enabled: false }
  );

  const identity = useIdentity();
  const userId =
    pageUserIdNumber && !Number.isNaN(pageUserIdNumber) ? pageUserIdNumber : 0;
  const optimisticAvatar = getOptimisticAvatar(userId);

  // During the active transition period after an optimistic update, prioritize the optimistic avatar.
  // Otherwise, prioritize the session's identity avatar (authoritative), and fall back to the DTO cache.
  if (optimisticAvatar) {
    return optimisticAvatar;
  }

  return identity.avatar ?? userDto?.avatar ?? null;
}
