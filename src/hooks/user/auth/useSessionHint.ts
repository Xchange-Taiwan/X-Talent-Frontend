'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';

import {
  clearSessionHint,
  decodeSessionHint,
  DOM_AUTH_AVATAR_ATTR,
  DOM_AUTH_STATE_ATTR,
  isValidAvatarProtocol,
  readCookie,
  ResolvedIdentity,
  resolveIdentity,
  SESSION_HINT_COOKIE,
  SessionHint,
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
 * Reads the middleware-written hint cookie and combines it with the live
 * NextAuth session - this is the only place `resolveIdentity` is called.
 * Both the pre-hydration DOM attributes this hook writes (so the header can
 * render the right shape before `useSession()` resolves) and every other
 * identity consumer in the app (via `useIdentity`) read the same resolved
 * value, so there is nothing left for them to disagree on.
 *
 * The cookie read stays in an effect - reading `document.cookie` during
 * render would differ between the server and first client render - while
 * combining it with `session`/`status` happens synchronously in a `useMemo`
 * so the resolved identity tracks live session changes without waiting on
 * an extra effect/render cycle.
 *
 * Deliberately never applies the client-only avatar override: this hook's
 * DOM writes only matter during the pre-`authKnown` skeleton window, before
 * a profile edit (the only source of an override) could ever have happened.
 * `useIdentity` layers the override on top of the identity returned here.
 */
export function useSessionHint(): ResolvedIdentity {
  const { data: session, status } = useSession();
  const [hint, setHint] = useState<SessionHint | null | undefined>(undefined);

  useEffect(() => {
    const rawCookie = readCookie(SESSION_HINT_COOKIE);
    setHint(rawCookie !== undefined ? decodeSessionHint(rawCookie) : undefined);
  }, [session, status]);

  const identity = useMemo(
    () => resolveIdentity(session, status, hint),
    [session, status, hint]
  );

  useEffect(() => {
    if (identity.isLoggedIn) {
      document.documentElement.setAttribute(
        DOM_AUTH_STATE_ATTR,
        identity.isMentor ? 'mentor' : 'mentee'
      );
      updateAvatarStyle(identity.avatar);
    } else {
      clearAuthDOMState();
      document.documentElement.setAttribute(DOM_AUTH_STATE_ATTR, 'guest');
    }
  }, [identity]);

  return identity;
}
