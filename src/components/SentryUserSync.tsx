'use client';

import * as Sentry from '@sentry/nextjs';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

import { sanitizeSentryUserId } from '@/lib/sentrySanitize';

/**
 * Synchronizes de-identified NextAuth `session.user.id` and `user_role` tag
 * (`mentor` | `mentee` | `guest`) into Sentry scope without transmitting PII.
 */
export default function SentryUserSync(): null {
  const { data: session, status } = useSession();
  const rawUserId = session?.user?.id;
  const isMentor = session?.user?.isMentor;
  const sessionError = session?.error;

  useEffect(() => {
    if (sessionError === 'RefreshTokenError') {
      Sentry.setUser(null);
      Sentry.setTag('user_role', 'guest');
      return;
    }

    if (status === 'loading') {
      return;
    }

    if (status === 'authenticated') {
      const safeId = sanitizeSentryUserId(rawUserId);
      if (safeId) {
        Sentry.setUser({ id: safeId });
        Sentry.setTag('user_role', isMentor ? 'mentor' : 'mentee');
        return;
      }
    }

    Sentry.setUser(null);
    Sentry.setTag('user_role', 'guest');
  }, [isMentor, rawUserId, sessionError, status]);

  return null;
}
