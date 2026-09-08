'use client';

import { useResolvedIdentity } from '@/hooks/user/auth/useResolvedIdentity';
import { useOptimisticIdentity } from '@/hooks/user/identity/useOptimisticIdentity';

/**
 * Returns the avatar URL to render for the currently signed-in user.
 *
 * Prefers the optimistic identity projection (set synchronously on a
 * successful profile submit via `applyIdentityPatch`, see
 * `@/lib/identity/identityProjection`) for as long as it's within its
 * transition window, and falls back to the resolved identity avatar
 * (which handles the session hint cookie) otherwise.
 * Bridges the gap left by NextAuth v4's `update()` round-trip - without it
 * the header shows the old avatar between submit and the session refetch landing.
 */
export function useCurrentAvatar(): string | null {
  const identity = useResolvedIdentity();
  const userIdStr = identity.userId;
  const validUserId = Number(userIdStr) || 0;

  const optimisticIdentity = useOptimisticIdentity(validUserId || null);

  // During the active transition period after an optimistic update, prioritize the optimistic avatar.
  // Otherwise, prioritize the session's identity avatar (authoritative).
  if (optimisticIdentity !== undefined) {
    return optimisticIdentity.avatar ?? null;
  }

  return identity.avatar ?? null;
}
