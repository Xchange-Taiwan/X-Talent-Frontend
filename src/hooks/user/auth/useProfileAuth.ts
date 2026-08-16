'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

import { resolveIdentity } from '@/lib/auth/sessionHint';

export function useProfileAuth(pageUserId: string) {
  const router = useRouter();
  const { data: session, status } = useSession();

  const identity = resolveIdentity(null, session, status);
  const isAuthorized = identity.userId === pageUserId;

  useEffect(() => {
    // Redirect if identity is fully known (either session settled or hint is known and did not match)
    if (identity.authKnown && !identity.isResolvingUser && !isAuthorized) {
      router.push('/');
    }
  }, [isAuthorized, identity.authKnown, identity.isResolvingUser, router]);

  return { isAuthorized };
}
