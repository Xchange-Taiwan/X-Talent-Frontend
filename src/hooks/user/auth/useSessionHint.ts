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
} from '@/lib/auth/sessionHint';
import { useAvatarOverride } from '@/lib/avatar/avatarOverrideStore';

export type SessionHintState =
  | { status: 'unknown' }
  | { status: 'guest' }
  | {
      status: 'authenticated';
      isMentor: boolean;
      avatar?: string;
      userId?: string;
    };

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
  const override = useAvatarOverride();
  const [state, setState] = useState<SessionHintState>({ status: 'unknown' });

  useEffect(() => {
    const hint = decodeSessionHint(readCookie(SESSION_HINT_COOKIE));
    const identity = resolveIdentity(override, session, status, hint);

    if (!identity.isLoggedIn) {
      clearAuthDOMState();
      document.documentElement.setAttribute(DOM_AUTH_STATE_ATTR, 'guest');

      setState((prev) => {
        if (prev.status === 'guest') {
          return prev;
        }
        return { status: 'guest' };
      });
    } else {
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
    }
  }, [session, status, override]);

  return state;
}
