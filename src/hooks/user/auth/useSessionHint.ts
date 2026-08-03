'use client';

import { useSession } from 'next-auth/react';
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
  const { data: session, status } = useSession();
  const [state, setState] = useState<SessionHintState>({ status: 'unknown' });

  useEffect(() => {
    const hint = decodeSessionHint(readCookie(SESSION_HINT_COOKIE));

    // 1. If we are explicitly logged out (unauthenticated), clear all DOM state
    if (status === 'unauthenticated') {
      document.documentElement.removeAttribute(DOM_AUTH_STATE_ATTR);
      document.documentElement.removeAttribute(DOM_AUTH_AVATAR_ATTR);
      const styleTag =
        document.getElementById('session-hint-styles') ||
        document.head.querySelector('#session-hint-styles') ||
        document.querySelector('#session-hint-styles');
      if (styleTag) {
        if (styleTag.parentNode) {
          styleTag.parentNode.removeChild(styleTag);
        } else {
          styleTag.remove();
        }
      }

      setState({ status: 'guest' });
      return;
    }

    // 2. If the real session is resolved, sync the DOM state with the real session data
    if (status === 'authenticated' && session?.user) {
      const realIsMentor = session.user.isMentor ?? false;
      const realAvatar = session.user.avatar ?? undefined;

      document.documentElement.setAttribute(
        DOM_AUTH_STATE_ATTR,
        realIsMentor ? 'mentor' : 'mentee'
      );

      const styleTag =
        document.getElementById('session-hint-styles') ||
        document.head.querySelector('#session-hint-styles') ||
        document.querySelector('#session-hint-styles');
      if (realAvatar) {
        document.documentElement.setAttribute(DOM_AUTH_AVATAR_ATTR, realAvatar);
        const escapedAvatar = realAvatar.replace(/"/g, '%22');
        if (styleTag) {
          styleTag.innerHTML = `:root { --auth-avatar: url("${escapedAvatar}"); }`;
        } else {
          const newStyle = document.createElement('style');
          newStyle.id = 'session-hint-styles';
          newStyle.innerHTML = `:root { --auth-avatar: url("${escapedAvatar}"); }`;
          document.head.appendChild(newStyle);
        }
      } else {
        document.documentElement.removeAttribute(DOM_AUTH_AVATAR_ATTR);
        if (styleTag) styleTag.remove();
      }

      setState({
        status: 'authenticated',
        isMentor: realIsMentor,
        avatar: realAvatar,
      });
      return;
    }

    // 3. During initial loading, fall back to the safe session-hint cookie
    if (status === 'loading') {
      if (hint) {
        document.documentElement.setAttribute(
          DOM_AUTH_STATE_ATTR,
          hint.isMentor ? 'mentor' : 'mentee'
        );
      } else {
        document.documentElement.removeAttribute(DOM_AUTH_STATE_ATTR);
      }

      const styleTag =
        document.getElementById('session-hint-styles') ||
        document.head.querySelector('#session-hint-styles') ||
        document.querySelector('#session-hint-styles');
      if (hint && hint.avatar) {
        document.documentElement.setAttribute(
          DOM_AUTH_AVATAR_ATTR,
          hint.avatar
        );
        const escapedAvatar = hint.avatar.replace(/"/g, '%22');
        if (styleTag) {
          styleTag.innerHTML = `:root { --auth-avatar: url("${escapedAvatar}"); }`;
        } else {
          const newStyle = document.createElement('style');
          newStyle.id = 'session-hint-styles';
          newStyle.innerHTML = `:root { --auth-avatar: url("${escapedAvatar}"); }`;
          document.head.appendChild(newStyle);
        }
      } else {
        document.documentElement.removeAttribute(DOM_AUTH_AVATAR_ATTR);
        if (styleTag) styleTag.remove();
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
    }
  }, [session, status]);

  return state;
}
