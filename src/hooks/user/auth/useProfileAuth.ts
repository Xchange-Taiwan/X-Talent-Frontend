'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { useSessionHint } from '@/hooks/user/auth/useSessionHint';
import { resolveIdentity } from '@/lib/auth/sessionHint';

export function useProfileAuth(pageUserId: string) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const hintState = useSessionHint();

  // Lazy-init from a cached session or session-hint so client-side navigation does not flash
  // a false isAuthorized for one frame before the effect catches up.
  const [isAuthorized, setIsAuthorized] = useState(() => {
    const hint = hintState.status === 'authenticated' ? hintState : null;
    const identity = resolveIdentity(null, session, status, hint);
    return Boolean(identity.userId) && identity.userId === pageUserId;
  });

  useEffect(() => {
    const hint = hintState.status === 'authenticated' ? hintState : null;
    const identity = resolveIdentity(null, session, status, hint);

    const hasFullUser = Boolean(session?.user?.id);
    const sessionSettled = hasFullUser || status !== 'loading';

    // 1. If matching, authorize immediately
    if (identity.userId === pageUserId) {
      setIsAuthorized(true);
      return;
    }

    // 2. Redirect if either session is fully settled (and did not match)
    // OR we are loading but have an authenticated hint with a different userId.
    const isDifferentUserHint =
      status === 'loading' &&
      identity.userId !== undefined &&
      identity.userId !== pageUserId;

    if (sessionSettled || isDifferentUserHint) {
      router.push('/');
    }
  }, [pageUserId, router, session, status, hintState]);

  return { isAuthorized };
}
