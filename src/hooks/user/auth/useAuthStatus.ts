'use client';

import { useSession } from 'next-auth/react';

import { useSessionHint } from './useSessionHint';

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
  const { data: session, status } = useSession();
  const hint = useSessionHint();

  const realUserId = session?.user?.id;
  const hasFullUser = Boolean(realUserId);
  // `status` only reliably means "no session data at all" when there is no
  // cached session yet — during a NextAuth `update()` call `status` flips
  // back to "loading" while `data` still holds the previous session. Gate on
  // `hasFullUser` first so an in-flight `update()` doesn't fall back to a
  // (possibly stale) hint; only once neither is available do we consult it.
  const sessionSettled = hasFullUser || status !== 'loading';

  const authKnown = sessionSettled || hint.status !== 'unknown';
  const isLoggedIn = sessionSettled
    ? hasFullUser
    : hint.status === 'authenticated';
  const isMentor = hasFullUser
    ? Boolean(session?.user?.isMentor)
    : sessionSettled
      ? false
      : hint.status === 'authenticated' && hint.isMentor;
  const userId = hasFullUser
    ? realUserId
    : sessionSettled
      ? undefined
      : hint.status === 'authenticated'
        ? hint.userId
        : undefined;
  const isResolvingUser = isLoggedIn && !userId;

  return {
    authKnown,
    isLoggedIn,
    isMentor,
    userId,
    hasFullUser,
    isResolvingUser,
  };
}
