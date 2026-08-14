'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import {
  clearSessionHint,
  decodeSessionHint,
  DOM_AUTH_AVATAR_ATTR,
  DOM_AUTH_STATE_ATTR,
  isValidAvatarProtocol,
  safeDecodeURIComponent,
  SESSION_HINT_COOKIE,
} from '@/lib/auth/sessionHint';

export type SessionHintState =
  | { status: 'unknown' }
  | { status: 'guest' }
  | {
      status: 'authenticated';
      isMentor: boolean;
      avatar?: string;
      userId?: string;
    };

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const raw = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  if (raw === undefined) return undefined;

  // `response.cookies.set()` encodeURIComponent's the whole value on write
  // (including our own `|` separator), so it must be decoded once on read.
  // Fall back to the raw value on failure rather than discarding the whole
  // hint - `decodeSessionHint` still safely handles a malformed avatar part.
  return safeDecodeURIComponent(raw);
}

function updateAvatarStyle(avatar: string | undefined): void {
  if (typeof document === 'undefined') return;

  // Guard and validate URL scheme exactly like our pre-hydration inline script
  const isValidUrl = avatar && isValidAvatarProtocol(avatar);

  if (isValidUrl && avatar) {
    document.documentElement.setAttribute(DOM_AUTH_AVATAR_ATTR, avatar);
    const escapedAvatar = avatar.replace(/"/g, '%22');
    document.documentElement.style.setProperty(
      '--auth-avatar',
      `url("${escapedAvatar}")`
    );
  } else {
    removeAvatarStyle();
  }
}

function removeAvatarStyle(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.removeAttribute(DOM_AUTH_AVATAR_ATTR);
  document.documentElement.style.removeProperty('--auth-avatar');
}

function clearAuthDOMState(): void {
  clearSessionHint();
}

/**
 * Reads the middleware-written hint cookie so the header can render the
 * right shape before `useSession()` resolves.
 */
export function useSessionHint(): SessionHintState {
  const { data: session, status } = useSession();
  const [state, setState] = useState<SessionHintState>({ status: 'unknown' });

  useEffect(() => {
    const hint = decodeSessionHint(readCookie(SESSION_HINT_COOKIE));

    // 1. If we are explicitly logged out (unauthenticated), clear stale hint
    // state but keep the DOM marked as 'guest' so the CSS-toggled guest UI
    // (see SESSION_HINT_INLINE_SCRIPT) doesn't revert to a loading skeleton.
    if (status === 'unauthenticated') {
      clearAuthDOMState();
      document.documentElement.setAttribute(DOM_AUTH_STATE_ATTR, 'guest');

      setState((prev) => {
        if (prev.status === 'guest') {
          return prev;
        }
        return { status: 'guest' };
      });
      return;
    }

    // 2. If the real session is resolved, sync the DOM state with the real session data
    if (status === 'authenticated' && session?.user) {
      const realIsMentor = session.user.isMentor ?? false;
      const realAvatar = session.user.avatar ?? undefined;
      const realUserId = session.user.id ?? undefined;

      document.documentElement.setAttribute(
        DOM_AUTH_STATE_ATTR,
        realIsMentor ? 'mentor' : 'mentee'
      );
      updateAvatarStyle(realAvatar);

      setState((prev) => {
        if (
          prev.status === 'authenticated' &&
          prev.isMentor === realIsMentor &&
          prev.avatar === realAvatar &&
          prev.userId === realUserId
        ) {
          return prev;
        }
        return {
          status: 'authenticated',
          isMentor: realIsMentor,
          avatar: realAvatar,
          userId: realUserId,
        };
      });
      return;
    }

    // 3. During initial loading, fall back to the safe session-hint cookie.
    // No hint cookie means the middleware didn't see a valid token on the
    // last request, so treat the visitor as a guest immediately instead of
    // waiting on the slower useSession() round trip.
    if (status === 'loading') {
      if (hint) {
        document.documentElement.setAttribute(
          DOM_AUTH_STATE_ATTR,
          hint.isMentor ? 'mentor' : 'mentee'
        );
        updateAvatarStyle(hint.avatar);
      } else {
        clearAuthDOMState();
        document.documentElement.setAttribute(DOM_AUTH_STATE_ATTR, 'guest');
      }

      setState((prev) => {
        if (!hint) {
          return prev.status === 'guest' ? prev : { status: 'guest' };
        }

        if (
          prev.status === 'authenticated' &&
          prev.isMentor === hint.isMentor &&
          prev.avatar === hint.avatar &&
          prev.userId === hint.userId
        ) {
          return prev;
        }

        return {
          status: 'authenticated',
          isMentor: hint.isMentor,
          avatar: hint.avatar,
          userId: hint.userId,
        };
      });
    }
  }, [session, status]);

  return state;
}
