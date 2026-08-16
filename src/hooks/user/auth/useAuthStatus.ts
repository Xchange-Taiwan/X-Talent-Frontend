'use client';

import { useIdentity } from './useIdentity';

export interface AuthStatus {
  /** Whether we know anything at all (from hint or real session) yet. */
  authKnown: boolean;
  isLoggedIn: boolean;
  isMentor: boolean;
  /**
   * The real session's id once it lands; before that, falls back to the
   * fast hint cookie's id (non-authoritative, but already public via the
   * `/profile/{userId}` URL) so nav links don't have to sit disabled while
   * waiting on `useSession()`.
   */
  userId: string | undefined;
  /** Whether the full `useSession()` payload (id, avatar, email, …) has landed. */
  hasFullUser: boolean;
  /**
   * Logged in, but neither the real session nor the hint cookie has a
   * usable `userId` yet. Any link that needs `userId` must be disabled
   * during this window rather than falling back to a signed-out
   * destination like `/auth/signup` or `/`.
   */
  isResolvingUser: boolean;
}

/**
 * Combines `useSession()` with the fast `useSessionHint()` fallback so
 * layout that needs to know the auth/mentor state doesn't have to wait on
 * the `/api/auth/session` round trip before rendering. The real session
 * always wins once it lands.
 */
export function useAuthStatus(): AuthStatus {
  const identity = useIdentity(null);

  return {
    authKnown: identity.authKnown,
    isLoggedIn: identity.isLoggedIn,
    isMentor: identity.isMentor,
    userId: identity.userId,
    hasFullUser: identity.hasFullUser,
    isResolvingUser: identity.isResolvingUser,
  };
}
