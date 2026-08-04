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

function getStyleTag(): HTMLStyleElement | null {
  if (typeof document === 'undefined') return null;
  return (
    (document.getElementById('session-hint-styles') as HTMLStyleElement) ||
    document.head.querySelector('#session-hint-styles') ||
    document.querySelector('#session-hint-styles')
  );
}

function updateAvatarStyle(avatar: string | undefined): void {
  if (typeof document === 'undefined') return;
  const styleTag = getStyleTag();

  // Guard and validate URL scheme exactly like our pre-hydration inline script
  const isValidUrl =
    avatar &&
    (avatar.startsWith('https://') ||
      avatar.startsWith('http://') ||
      avatar.startsWith('/'));

  if (isValidUrl && avatar) {
    document.documentElement.setAttribute(DOM_AUTH_AVATAR_ATTR, avatar);
    const escapedAvatar = avatar.replace(/"/g, '%22');
    if (styleTag) {
      styleTag.innerHTML = `:root { --auth-avatar: url("${escapedAvatar}"); }`;
    } else {
      const newStyle = document.createElement('style');
      newStyle.id = 'session-hint-styles';
      newStyle.innerHTML = `:root { --auth-avatar: url("${escapedAvatar}"); }`;
      document.head.appendChild(newStyle);
    }
  } else {
    removeAvatarStyle();
  }
}

function removeAvatarStyle(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.removeAttribute(DOM_AUTH_AVATAR_ATTR);
  // Extremely defensive: also clear any legacy inline style property in case it was set by other scripts/sources
  document.documentElement.style.removeProperty('--auth-avatar');

  const styleTag = getStyleTag();
  if (styleTag) {
    if (styleTag.parentNode) {
      styleTag.parentNode.removeChild(styleTag);
    } else {
      styleTag.remove();
    }
  }
}

function clearAuthDOMState(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.removeAttribute(DOM_AUTH_STATE_ATTR);
  removeAvatarStyle();
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
      clearAuthDOMState();

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

      document.documentElement.setAttribute(
        DOM_AUTH_STATE_ATTR,
        realIsMentor ? 'mentor' : 'mentee'
      );
      updateAvatarStyle(realAvatar);

      setState((prev) => {
        if (
          prev.status === 'authenticated' &&
          prev.isMentor === realIsMentor &&
          prev.avatar === realAvatar
        ) {
          return prev;
        }
        return {
          status: 'authenticated',
          isMentor: realIsMentor,
          avatar: realAvatar,
        };
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
        updateAvatarStyle(hint.avatar);
      } else {
        clearAuthDOMState();
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
