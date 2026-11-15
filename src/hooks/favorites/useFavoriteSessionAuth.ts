'use client';

import { SessionContext } from 'next-auth/react';
import { useContext } from 'react';

export interface FavoriteSessionAuthState {
  confirmedUserId: string | null;
  isIdentityUnresolved: boolean;
  isAuthenticated: boolean;
}

export function useFavoriteSessionAuth(): FavoriteSessionAuthState {
  const sessionContext = useContext(SessionContext);
  const session = sessionContext?.data ?? null;
  const sessionStatus = sessionContext?.status ?? 'unauthenticated';

  const rawSessionUserId = session?.user?.id;
  const confirmedUserId =
    rawSessionUserId !== undefined &&
    rawSessionUserId !== null &&
    String(rawSessionUserId).trim() !== ''
      ? String(rawSessionUserId).trim()
      : null;

  const isIdentityUnresolved = !confirmedUserId && sessionStatus === 'loading';
  const isAuthenticated = confirmedUserId !== null;

  return {
    confirmedUserId,
    isIdentityUnresolved,
    isAuthenticated,
  };
}
