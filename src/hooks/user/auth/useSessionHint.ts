'use client';

import { useEffect, useState } from 'react';

import {
  decodeSessionHint,
  SESSION_HINT_COOKIE,
  type SessionHint,
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
  const [state, setState] = useState<SessionHintState>(() => {
    if (typeof window !== 'undefined') {
      const authState =
        document.documentElement.getAttribute('data-auth-state');
      if (authState) {
        const isMentor = authState === 'mentor';
        const avatar =
          document.documentElement.getAttribute('data-auth-avatar') ??
          undefined;
        return {
          status: 'authenticated',
          isMentor,
          avatar,
        };
      }
    }
    return { status: 'unknown' };
  });

  useEffect(() => {
    const hint: SessionHint | null = decodeSessionHint(
      readCookie(SESSION_HINT_COOKIE)
    );
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
