'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useIdentity } from './useIdentity';

export function useProfileAuth(pageUserId: string) {
  const router = useRouter();

  const identity = useIdentity(null);
  const isAuthorized =
    identity.state === 'confirmed-member' && identity.userId === pageUserId;
  const isResolving =
    identity.state === 'unknown' || identity.state === 'hint-only';

  useEffect(() => {
    if (isResolving) {
      return;
    }

    // Redirect if identity is fully known and the user is unauthorized
    if (!isAuthorized) {
      router.push('/');
    }
  }, [isAuthorized, isResolving, router]);

  return { isAuthorized, isResolving };
}
