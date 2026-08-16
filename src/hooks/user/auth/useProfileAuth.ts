'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import {
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
    const identity = resolveIdentity(null, session, status, rawCookie);

    // 1. If matching, authorize immediately
    if (identity.userId === pageUserId) {
      setIsAuthorized(true);
      return;
    }

    // 2. Redirect if identity is fully known (either session settled or hint is known and did not match)
    if (identity.authKnown && !identity.isResolvingUser) {
      setIsAuthorized(false);
      router.push('/');
    }
  }, [pageUserId, router, session, status]);

  return { isAuthorized };
}
