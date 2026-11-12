'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

import {
  resolveAnalyticsUserRole,
  sanitizeAnalyticsUserId,
  setAnalyticsUserContext,
} from '@/lib/analytics';

export interface AnalyticsUserSyncProps {
  /** Optional GA4 Measurement ID override (defaults to active Ga4Bootstrap ID or NEXT_PUBLIC_GA_ID). */
  gaId?: string;
}

/**
 * Synchronizes NextAuth `session.user.id` and platform role (`mentee` | `mentor` | `guest`)
 * with Google Analytics 4 (`gtag('config', gaId, { user_id })` and event context).
 *
 * Zero-PII guarantee: reads ONLY internal `session.user.id` and boolean `session.user.isMentor`
 * (never email, real name, or tokens), and dispatches `user_id: null` upon sign-out.
 */
export default function AnalyticsUserSync({
  gaId,
}: AnalyticsUserSyncProps = {}): null {
  const { data: session, status } = useSession();
  const rawUserId = session?.user?.id;
  const isMentor = session?.user?.isMentor;
  const sessionError = session?.error;

  useEffect(() => {
    const options = gaId ? { gaId } : undefined;

    if (sessionError === 'RefreshTokenError') {
      setAnalyticsUserContext(
        {
          userId: null,
          userRole: 'guest',
        },
        options
      );
      return;
    }

    if (status === 'loading') {
      return;
    }

    if (status === 'authenticated') {
      const safeUserId = sanitizeAnalyticsUserId(rawUserId);
      if (safeUserId) {
        const userRole = resolveAnalyticsUserRole({
          id: safeUserId,
          isMentor,
        });
        setAnalyticsUserContext(
          {
            userId: safeUserId,
            userRole,
          },
          options
        );
        return;
      }
    }

    setAnalyticsUserContext(
      {
        userId: null,
        userRole: 'guest',
      },
      options
    );
  }, [gaId, isMentor, rawUserId, sessionError, status]);

  return null;
}
