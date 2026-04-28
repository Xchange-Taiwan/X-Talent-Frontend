'use client';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export function useProfileAuth(pageUserId: string) {
  const router = useRouter();
  const { data: session, status } = useSession();
  // Lazy-init from a cached session so client-side navigation does not flash
  // a false isAuthorized for one frame before the effect catches up.
  const [isAuthorized, setIsAuthorized] = useState(() => {
    if (status === 'loading') return false;
    const loginUserId = session?.user?.id ? String(session.user.id) : '';
    return Boolean(loginUserId) && loginUserId === pageUserId;
  });

  useEffect(() => {
    if (status === 'loading') return;
    const loginUserId = session?.user?.id ? String(session.user.id) : '';
    if (!loginUserId || loginUserId !== pageUserId) {
      router.push('/');
      return;
    }
    setIsAuthorized(true);
  }, [pageUserId, router, session?.user?.id, status]);

  return { isAuthorized };
}
