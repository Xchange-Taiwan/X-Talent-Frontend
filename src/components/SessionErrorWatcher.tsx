'use client';

import { signOut, useSession } from 'next-auth/react';
import { useEffect } from 'react';

export default function SessionErrorWatcher() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.error === 'RefreshTokenError') {
      signOut({ callbackUrl: '/auth/signin' });
    }
  }, [session?.error]);

  return null;
}
