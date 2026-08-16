'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

import { readCookie, SESSION_HINT_COOKIE } from '@/lib/auth/sessionHint';

import { useIdentity } from './useIdentity';

export function useProfileAuth(pageUserId: string) {
  const router = useRouter();
  const { status } = useSession();

  const identity = useIdentity(null);
  const isAuthorized = identity.userId === pageUserId;

  useEffect(() => {
    const rawCookie = readCookie(SESSION_HINT_COOKIE);
    const hasCookie = rawCookie !== undefined;
    const sessionSettled = status !== 'loading';

    // Only redirect if:
    // - Session has settled (status !== 'loading')
    // - OR we have a cookie and it is confirmed unauthorized/guest (and is not resolving)
    if (
      (sessionSettled || hasCookie) &&
      !identity.isResolvingUser &&
      !isAuthorized
    ) {
      router.push('/');
    }
  }, [isAuthorized, identity.isResolvingUser, status, router]);

  return { isAuthorized };
}
