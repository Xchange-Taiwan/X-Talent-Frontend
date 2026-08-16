'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import {
  clearSessionHint,
  decodeSessionHint,
  DOM_AUTH_AVATAR_ATTR,
  DOM_AUTH_STATE_ATTR,
  isValidAvatarProtocol,
  readCookie,
  resolveIdentity,
  SESSION_HINT_COOKIE,
  SessionHintState,
} from '@/lib/auth/sessionHint';

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
 *
 * Deliberately never applies the client-only avatar override: this hook's
 * DOM writes only matter during the pre-`authKnown` skeleton window, before
 * a profile edit (the only source of an override) could ever have happened.
 * Baking the override in here would make its avatar value differ across the
 * several components that mount this hook, racing each other's DOM writes.
 * `resolveIdentity` is still the single place an override is applied, from
 * whichever call site actually cares about it (see `useIdentity`).
 */
export function useSessionHint(): SessionHintState {
  const { data: session, status } = useSession();
  const [state, setState] = useState<SessionHintState>({ status: 'unknown' });

  useEffect(() => {
    const rawCookie = readCookie(SESSION_HINT_COOKIE);
    const hasCookie = rawCookie !== undefined;
    const decoded = hasCookie ? decodeSessionHint(rawCookie) : undefined;
    const identity = resolveIdentity(null, session, status, decoded);

    if (identity.isLoggedIn) {
      document.documentElement.setAttribute(
        DOM_AUTH_STATE_ATTR,
        identity.isMentor ? 'mentor' : 'mentee'
      );
      updateAvatarStyle(identity.avatar);

      setState((prev) => {
        if (
          prev.status === 'authenticated' &&
          prev.isMentor === identity.isMentor &&
          prev.avatar === identity.avatar &&
          prev.userId === identity.userId
        ) {
          return prev;
        }
        return {
          status: 'authenticated',
          isMentor: identity.isMentor,
          avatar: identity.avatar,
          userId: identity.userId,
        };
      });
    } else {
      clearAuthDOMState();
      document.documentElement.setAttribute(DOM_AUTH_STATE_ATTR, 'guest');

      setState((prev) => {
        if (prev.status === 'guest' && prev.hasCookie === hasCookie) {
          return prev;
        }
        return { status: 'guest', hasCookie };
      });
    }
  }, [session, status]);

  return state;
}
