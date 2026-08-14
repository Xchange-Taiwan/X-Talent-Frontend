'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { useSessionHint } from '@/hooks/user/auth/useSessionHint';

export function useProfileAuth(pageUserId: string) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const hintState = useSessionHint();

  // Lazy-init from a cached session or session-hint so client-side navigation does not flash
  // a false isAuthorized for one frame before the effect catches up.
  const [isAuthorized, setIsAuthorized] = useState(() => {
    const loginUserId = session?.user?.id
      ? String(session.user.id)
      : hintState.status === 'authenticated'
        ? hintState.userId
        : undefined;
    return Boolean(loginUserId) && loginUserId === pageUserId;
  });

  useEffect(() => {
    const hasFullUser = Boolean(session?.user?.id);
    const sessionSettled = hasFullUser || status !== 'loading';

    // Synchronously check session first, fallback to hintState if loading to avoid 1-frame async lag
    const loginUserId = session?.user?.id
      ? String(session.user.id)
      : hintState.status === 'authenticated'
        ? hintState.userId
        : undefined;

    // 1. If matching, authorize immediately
    if (loginUserId === pageUserId) {
      setIsAuthorized(true);
      return;
    }

    // 2. Redirect if either session is fully settled (and did not match)
    // OR we are loading but have an authenticated hint with a different userId
    // OR we are loading but have a guest hint.
    const isDifferentUserHint =
      status === 'loading' &&
      loginUserId !== undefined &&
      loginUserId !== pageUserId;

    const isGuestHint = status === 'loading' && hintState.status === 'guest';

    if (sessionSettled || isDifferentUserHint || isGuestHint) {
      router.push('/');
    }
  }, [pageUserId, router, session, status, hintState]);

  return { isAuthorized };
}
