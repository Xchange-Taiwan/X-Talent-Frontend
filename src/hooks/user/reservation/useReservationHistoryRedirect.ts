'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useRef } from 'react';

import { isFeedbackEnabled } from '@/lib/featureFlags';
import {
  type FeedbackSessionCoordinator,
  feedbackSessionCoordinator,
} from '@/lib/reservation/feedbackSessionCoordinator';
import {
  buildReservationHistoryRedirectHref,
  type ReservationRouteRole,
} from '@/lib/reservation/reservationRoutes';

export { buildReservationHistoryRedirectHref };

export function useReservationHistoryRedirect(
  coordinator: FeedbackSessionCoordinator = feedbackSessionCoordinator
): void {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const redirectedKeyRef = useRef<string | null>(null);
  const routerRef = useRef(router);
  routerRef.current = router;

  const feedbackEnabled = isFeedbackEnabled();
  const rawSearch = searchParams.toString();
  const fallbackRole: ReservationRouteRole = session?.user?.isMentor
    ? 'mentor'
    : 'mentee';
  const userId = session?.user?.id ? String(session.user.id) : '';

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    const authStatus =
      status === 'unauthenticated' ? 'unauthenticated' : 'authenticated';
    const effectKey = `${authStatus}:${userId}:${fallbackRole}:${rawSearch}:${String(feedbackEnabled)}`;

    if (redirectedKeyRef.current === effectKey) {
      return;
    }

    const controller = new AbortController();

    void coordinator
      .resolveHistoryRedirect({
        authStatus,
        userId,
        fallbackRole,
        rawSearch,
        feedbackEnabled,
        signal: controller.signal,
      })
      .then((resolved) => {
        if (controller.signal.aborted) return;
        redirectedKeyRef.current = effectKey;
        routerRef.current.replace(resolved.redirectHref, { scroll: false });
      });

    return () => {
      controller.abort();
    };
  }, [coordinator, fallbackRole, feedbackEnabled, rawSearch, status, userId]);
}
