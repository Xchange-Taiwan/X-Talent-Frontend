'use client';

import { useEffect, useState } from 'react';

import {
  decodeSessionHint,
  SESSION_HINT_COOKIE,
  type SessionHint,
} from '@/lib/auth/sessionHint';

function readCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export type SessionHintState =
  | { status: 'unknown' }
  | { status: 'guest' }
  | { status: 'authenticated'; isMentor: boolean };

/**
 * Reads the middleware-written hint cookie so the header can render the
 * right shape before `useSession()` resolves. Deferred to an effect (rather
 * than a lazy useState initializer) because the server render has no cookie
 * access — reading it during the first client render would mismatch.
 */
export function useSessionHint(): SessionHintState {
  const [state, setState] = useState<SessionHintState>({ status: 'unknown' });

  useEffect(() => {
    const hint: SessionHint | null = decodeSessionHint(
      readCookie(SESSION_HINT_COOKIE)
    );
    setState(
      hint
        ? { status: 'authenticated', isMentor: hint.isMentor }
        : { status: 'guest' }
    );
  }, []);

  return state;
}
