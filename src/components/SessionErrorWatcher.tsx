'use client';

import { signOut, useSession } from 'next-auth/react';
import { useEffect } from 'react';

import { clearAnalyticsUser } from '@/lib/analytics';

export default function SessionErrorWatcher() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.error === 'RefreshTokenError') {
      clearAnalyticsUser();
      signOut({ callbackUrl: '/auth/signin' });
    }
  }, [session?.error]);

  return null;
}
