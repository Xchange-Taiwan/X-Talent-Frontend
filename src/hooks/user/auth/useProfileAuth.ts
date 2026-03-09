'use client';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export function useProfileAuth(pageUserId: string) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isAuthorized, setIsAuthorized] = useState(false);

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
