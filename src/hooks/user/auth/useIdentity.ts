'use client';

import { useSession } from 'next-auth/react';
import { useMemo } from 'react';

import {
  ResolvedIdentity,
  resolveIdentity,
  SessionHint,
} from '@/lib/auth/sessionHint';
import { useAvatarOverride } from '@/lib/avatar/avatarOverrideStore';

import { useSessionHint } from './useSessionHint';

/**
 * Custom Hook that combines `useSession()`, `useSessionHint()` and optional avatar override
 * to resolve the unified user authentication identity synchronously.
 */
export function useIdentity(
  overrideInput?: { userId: string; url: string } | null
): ResolvedIdentity {
  const { data: session, status } = useSession();
  const hint = useSessionHint();
  const localOverride = useAvatarOverride();
  const override = overrideInput !== undefined ? overrideInput : localOverride;

  const parsedHint = useMemo((): SessionHint | null | undefined => {
    if (hint.status === 'guest') {
      if (hint.hasCookie === false) {
        return undefined;
      }
      return null;
    }
    if (hint.status === 'authenticated') {
      return {
        isMentor: hint.isMentor,
        avatar: hint.avatar,
        userId: hint.userId,
      };
    }
    return undefined; // status === 'unknown'
  }, [hint]);

  return useMemo(
    () => resolveIdentity(override, session, status, parsedHint),
    [override, session, status, parsedHint]
  );
}
