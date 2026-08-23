'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useIdentity } from './useIdentity';

export function useProfileAuth(pageUserId: string) {
  const router = useRouter();

  const identity = useIdentity();
  const isAuthorized = identity.userId === pageUserId;

  useEffect(() => {
    if (!identity.authKnown) return;

    // Redirect if identity is fully known and the user is un-authorized
    if (!identity.isResolvingUser && !isAuthorized) {
      router.push('/');
    }
  }, [isAuthorized, identity.authKnown, identity.isResolvingUser, router]);

  return { isAuthorized };
}
