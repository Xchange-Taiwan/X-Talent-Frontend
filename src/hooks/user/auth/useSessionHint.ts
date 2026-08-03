'use client';

import { useEffect, useState } from 'react';

import {
  decodeSessionHint,
  DOM_AUTH_AVATAR_ATTR,
  DOM_AUTH_STATE_ATTR,
  SESSION_HINT_COOKIE,
} from '@/lib/auth/sessionHint';

export type SessionHintState =
  | { status: 'unknown' }
  | { status: 'guest' }
  | { status: 'authenticated'; isMentor: boolean; avatar?: string };

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

/**
 * Reads the middleware-written hint cookie so the header can render the
 * right shape before `useSession()` resolves.
 */
export function useSessionHint(): SessionHintState {
  const [state, setState] = useState<SessionHintState>({ status: 'unknown' });

  useEffect(() => {
    const hint = decodeSessionHint(readCookie(SESSION_HINT_COOKIE));

    // 1. Sync or clear data-auth-state based on isMentor
    if (hint) {
      document.documentElement.setAttribute(
        DOM_AUTH_STATE_ATTR,
        hint.isMentor ? 'mentor' : 'mentee'
      );
    } else {
      document.documentElement.removeAttribute(DOM_AUTH_STATE_ATTR);
    }

    // 2. Sync or clear data-auth-avatar and CSS custom property --auth-avatar based on avatar
    if (hint && hint.avatar) {
      document.documentElement.setAttribute(DOM_AUTH_AVATAR_ATTR, hint.avatar);
      document.documentElement.style.setProperty(
        '--auth-avatar',
        `url("${hint.avatar}")`
      );
    } else {
      document.documentElement.removeAttribute(DOM_AUTH_AVATAR_ATTR);
      document.documentElement.style.removeProperty('--auth-avatar');
    }

    setState((prev) => {
      const nextStatus = hint ? 'authenticated' : 'guest';
      const nextIsMentor = hint ? hint.isMentor : false;
      const nextAvatar = hint ? hint.avatar : undefined;

      if (
        prev.status === nextStatus &&
        (prev.status !== 'authenticated' ||
          (prev.isMentor === nextIsMentor && prev.avatar === nextAvatar))
      ) {
        return prev;
      }

      return hint
        ? {
            status: 'authenticated',
            isMentor: hint.isMentor,
            avatar: hint.avatar,
          }
        : { status: 'guest' };
    });
  }, []);

  return state;
}
