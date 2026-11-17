'use client';

import * as Sentry from '@sentry/nextjs';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

const SAFE_USER_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function sanitizeSentryUserId(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed.includes('@')) return null;
  return SAFE_USER_ID_RE.test(trimmed) ? trimmed : null;
}

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
