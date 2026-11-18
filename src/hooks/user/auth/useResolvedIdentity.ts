'use client';

import { useSession } from 'next-auth/react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  decodeSessionHint,
  readCookie,
  type ResolvedIdentity,
  resolveIdentity,
  SESSION_HINT_COOKIE,
  type SessionHint,
  syncSessionHintDomAndCookie,
} from '@/lib/auth/sessionHint';
import { profileReadModel } from '@/lib/profile/profileReadModel';

export type { ResolvedIdentity };

const getServerOptimisticSnapshot = () => undefined;

/**
 * Reads the middleware-written session-hint cookie and combines it with the
 * live NextAuth session and any active optimistic identity projection from
 * `profileReadModel` - this is the only place `resolveIdentity` is called.
 *
 * The cookie read stays in an effect so server and first client render agree,
 * while combining `session`/`status`/`hint`/`optimisticSnapshot` happens
 * synchronously in `useMemo` and post-hydration DOM + cookie synchronization
 * is delegated to `syncSessionHintDomAndCookie`.
 */
export function useResolvedIdentity(): ResolvedIdentity {
  const { data: session, status } = useSession();
  const [hint, setHint] = useState<SessionHint | null | undefined>(undefined);

  const rawUserId = session?.user?.id ? Number(session.user.id) : NaN;
  const sessionUserId =
    Number.isFinite(rawUserId) && rawUserId > 0 ? rawUserId : null;

  const subscribeOptimistic = useCallback(
    (listener: () => void) =>
      sessionUserId !== null
        ? profileReadModel.observeOptimisticIdentity(sessionUserId, listener)
        : () => {},
    [sessionUserId]
  );

  const getOptimisticSnapshot = useCallback(
    () =>
      sessionUserId !== null
        ? profileReadModel.getOptimisticIdentity(sessionUserId)
        : undefined,
    [sessionUserId]
  );

  const optimisticSnapshot = useSyncExternalStore(
    subscribeOptimistic,
    getOptimisticSnapshot,
    getServerOptimisticSnapshot
  );

  useEffect(() => {
    const rawCookie = readCookie(SESSION_HINT_COOKIE);
    setHint(rawCookie !== undefined ? decodeSessionHint(rawCookie) : undefined);
  }, [session, status]);

  const identity = useMemo(
    () => resolveIdentity(session, status, hint, optimisticSnapshot),
    [session, status, hint, optimisticSnapshot]
  );

  useEffect(() => {
    syncSessionHintDomAndCookie(identity);
  }, [identity]);

  return identity;
}
