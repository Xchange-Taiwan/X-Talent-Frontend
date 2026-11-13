'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Suspense, useEffect, useRef } from 'react';

import { ReservationListSkeleton } from '@/app/reservation/skeleton';
import { extractDeepLinkReservationId } from '@/lib/reservation/feedbackDeepLink';
import { fetchSingleReservationFeedback } from '@/services/reservations/reservationFeedbackLookup';

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

function ReservationHistoryLoadingShell() {
  return (
    <div className="flex min-h-[calc(100vh-70px)] justify-center pb-12">
      <div className="w-full max-w-[90%] rounded-2xl md:max-w-[800px]">
        <ReservationListSkeleton />
      </div>
    </div>
  );
}

function ReservationHistoryRedirector() {
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
        if (cancelled) return;
        redirectedKeyRef.current = effectKey;
        const resolvedRole = lookup?.viewerRole ?? fallbackRole;
        router.replace(
          buildReservationHistoryRedirectHref(resolvedRole, rawSearch),
          { scroll: false }
        );
      })
      .catch(() => {
        if (cancelled) return;
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

  return <ReservationHistoryLoadingShell />;
}

export default function ReservationHistoryPage() {
  return (
    <Suspense fallback={<ReservationHistoryLoadingShell />}>
      <ReservationHistoryRedirector />
    </Suspense>
  );
}
