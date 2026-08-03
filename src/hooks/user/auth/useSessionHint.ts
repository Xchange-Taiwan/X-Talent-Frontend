'use client';

import { useEffect, useState } from 'react';

import {
  decodeSessionHint,
  SESSION_HINT_COOKIE,
  type SessionHint,
} from '@/lib/auth/sessionHint';

import { useInitialSessionHint } from './SessionHintContext';

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export type SessionHintState =
  | { status: 'unknown' }
  | { status: 'guest' }
  | { status: 'authenticated'; isMentor: boolean; avatar?: string };

/**
 * Reads the middleware-written hint cookie so the header can render the
 * right shape before `useSession()` resolves.
 */
export function useSessionHint(): SessionHintState {
  const initialHint = useInitialSessionHint();

  const [state, setState] = useState<SessionHintState>(() => {
    if (initialHint) {
      return {
        status: 'authenticated',
        isMentor: initialHint.isMentor,
        avatar: initialHint.avatar,
      };
    }
    return { status: 'unknown' };
  });

  useEffect(() => {
    const hint: SessionHint | null = decodeSessionHint(
      readCookie(SESSION_HINT_COOKIE)
    );
    setState(
      hint
        ? {
            status: 'authenticated',
            isMentor: hint.isMentor,
            avatar: hint.avatar,
          }
        : { status: 'guest' }
    );
  }, []);

  return state;
}
