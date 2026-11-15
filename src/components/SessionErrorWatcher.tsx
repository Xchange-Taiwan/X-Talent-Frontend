'use client';

import { signOut, useSession } from 'next-auth/react';
import { useEffect } from 'react';

import { terminateClientSession } from '@/lib/auth/sessionLifecycle';

export default function SessionErrorWatcher() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.error === 'RefreshTokenError') {
      void terminateClientSession('refresh_token_error', { signOut });
    }
  }, [session?.error]);

  return null;
}
