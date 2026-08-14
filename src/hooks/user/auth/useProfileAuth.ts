'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import {
  decodeSessionHint,
  readCookie,
  resolveIdentity,
  SESSION_HINT_COOKIE,
} from '@/lib/auth/sessionHint';

export function useProfileAuth(pageUserId: string) {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Lazy-init from a cached session so client-side navigation does not flash
  // a false isAuthorized for one frame before the effect catches up.
  // Avoids reading document.cookie during lazy-init to prevent React Hydration Mismatch.
  const [isAuthorized, setIsAuthorized] = useState(() => {
    const loginUserId = session?.user?.id ? String(session.user.id) : undefined;
    return Boolean(loginUserId) && loginUserId === pageUserId;
  });

  useEffect(() => {
    const rawCookie = readCookie(SESSION_HINT_COOKIE);
    const hint = decodeSessionHint(rawCookie);
    const identity = resolveIdentity(null, session, status, hint);

    const hasFullUser = Boolean(session?.user?.id);
    const sessionSettled = hasFullUser || status !== 'loading';

    // 1. If matching, authorize immediately
    if (identity.userId === pageUserId) {
      setIsAuthorized(true);
      return;
    }

    // 2. Redirect if either session is fully settled (and did not match)
    // OR we are loading but have an authenticated hint with a different userId
    // OR we are loading but have an explicit guest hint (cookie is present but not logged in).
    const isDifferentUserHint =
      status === 'loading' &&
      identity.userId !== undefined &&
      identity.userId !== pageUserId;

    const isGuestHint =
      status === 'loading' && rawCookie !== undefined && !identity.isLoggedIn;

    if (sessionSettled || isDifferentUserHint || isGuestHint) {
      router.push('/');
    }
  }, [pageUserId, router, session, status]);

  return { isAuthorized };
}
