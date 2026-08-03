'use client';

import { useEffect, useState } from 'react';

import { decodeSessionHint, SESSION_HINT_COOKIE } from '@/lib/auth/sessionHint';

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
    const authState = document.documentElement.getAttribute('data-auth-state');

    const resolvedHint =
      hint ??
      (authState
        ? {
            isMentor: authState === 'mentor',
            avatar:
              document.documentElement.getAttribute('data-auth-avatar') ??
              undefined,
          }
        : null);

    setState((prev) => {
      const nextStatus = resolvedHint ? 'authenticated' : 'guest';
      const nextIsMentor = resolvedHint ? resolvedHint.isMentor : false;
      const nextAvatar = resolvedHint ? resolvedHint.avatar : undefined;

      if (
        prev.status === nextStatus &&
        (prev.status !== 'authenticated' ||
          (prev.isMentor === nextIsMentor && prev.avatar === nextAvatar))
      ) {
        return prev;
      }

      return resolvedHint
        ? {
            status: 'authenticated',
            isMentor: resolvedHint.isMentor,
            avatar: resolvedHint.avatar,
          }
        : { status: 'guest' };
    });
  }, []);

  return state;
}
