'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useRef } from 'react';

import { extractDeepLinkReservationId } from '@/lib/reservation/feedbackDeepLink';
import { fetchSingleReservationFeedback } from '@/services/reservations';

export function buildReservationHistoryRedirectHref(
  role: 'mentee' | 'mentor',
  rawSearch: string
): string {
  const incoming = new URLSearchParams(rawSearch);
  const nextParams = new URLSearchParams();
  nextParams.set('tab', 'history');

  incoming.forEach((value, key) => {
    if (key === 'tab') {
      return;
    }
    nextParams.append(key, value);
  });

  return `/reservation/${role}?${nextParams.toString()}`;
}

export function useReservationHistoryRedirect(): void {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const redirectedKeyRef = useRef<string | null>(null);

  const rawSearch = searchParams.toString();
  const targetReservationId = extractDeepLinkReservationId(searchParams);

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (status === 'unauthenticated') {
      const callbackTarget = rawSearch
        ? `/reservation/history?${rawSearch}`
        : '/reservation/history';
      router.replace(
        `/auth/signin?callbackUrl=${encodeURIComponent(callbackTarget)}`,
        { scroll: false }
      );
      return;
    }

    const fallbackRole: 'mentee' | 'mentor' = session?.user?.isMentor
      ? 'mentor'
      : 'mentee';
    const userId = session?.user?.id ? String(session.user.id) : '';
    const effectKey = `${userId}:${fallbackRole}:${rawSearch}`;

    if (redirectedKeyRef.current === effectKey) {
      return;
    }

    if (!targetReservationId || !userId) {
      redirectedKeyRef.current = effectKey;
      router.replace(
        buildReservationHistoryRedirectHref(fallbackRole, rawSearch),
        { scroll: false }
      );
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    fetchSingleReservationFeedback({
      userId,
      reservationId: targetReservationId,
      fallbackRole,
      signal: controller.signal,
    })
      .then((lookup) => {
        if (cancelled || controller.signal.aborted) return;
        redirectedKeyRef.current = effectKey;
        const resolvedRole = lookup?.viewerRole ?? fallbackRole;
        router.replace(
          buildReservationHistoryRedirectHref(resolvedRole, rawSearch),
          { scroll: false }
        );
      })
      .catch(() => {
        if (cancelled || controller.signal.aborted) return;
        redirectedKeyRef.current = effectKey;
        router.replace(
          buildReservationHistoryRedirectHref(fallbackRole, rawSearch),
          { scroll: false }
        );
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [rawSearch, router, session, status, targetReservationId]);
}
