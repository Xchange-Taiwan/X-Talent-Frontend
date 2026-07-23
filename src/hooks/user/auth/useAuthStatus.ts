'use client';

import { useSession } from 'next-auth/react';

import { useSessionHint } from './useSessionHint';

export interface AuthStatus {
  /** Whether we know anything at all (from hint or real session) yet. */
  authKnown: boolean;
  isLoggedIn: boolean;
  isMentor: boolean;
  userId: string | undefined;
  /** Whether the full `useSession()` payload (id, avatar, email, …) has landed. */
  hasFullUser: boolean;
  /**
   * Logged in per the fast hint cookie, but the full session — and with it
   * `userId` — hasn't arrived yet. Any link that needs `userId` must be
   * disabled during this window rather than falling back to a signed-out
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

  const userId = session?.user?.id;
  const hasFullUser = Boolean(userId);
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
  const isResolvingUser = isLoggedIn && !hasFullUser;

  return {
    authKnown,
    isLoggedIn,
    isMentor,
    userId,
    hasFullUser,
    isResolvingUser,
  };
}
