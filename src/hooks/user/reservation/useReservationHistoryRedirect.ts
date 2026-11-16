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
  buildReservationHistorySignInCallbackHref,
  extractDeepLinkReservationId,
  type ReservationRouteRole,
  stripDeepLinkQueryParams,
  stripFeedbackQueueQueryParam,
} from '@/lib/reservation/reservationRoutes';
import { fetchSingleReservationFeedback } from '@/services/reservations';

export { buildReservationHistoryRedirectHref };

export function useReservationHistoryRedirect(
  coordinator: FeedbackSessionCoordinator = feedbackSessionCoordinator
): void {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const redirectedKeyRef = useRef<string | null>(null);

  const feedbackEnabled = isFeedbackEnabled();
  const rawSearch = searchParams.toString();
  const targetReservationId = extractDeepLinkReservationId(searchParams);

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    const sanitizedSearchWhenDisabled = stripFeedbackQueueQueryParam(
      stripDeepLinkQueryParams(rawSearch)
    );

    if (status === 'unauthenticated') {
      router.replace(
        buildReservationHistorySignInCallbackHref(
          feedbackEnabled ? rawSearch : sanitizedSearchWhenDisabled
        ),
        {
          scroll: false,
        }
      );
      return;
    }

    const fallbackRole: ReservationRouteRole = session?.user?.isMentor
      ? 'mentor'
      : 'mentee';
    const userId = session?.user?.id ? String(session.user.id) : '';
    const effectKey = `${userId}:${fallbackRole}:${rawSearch}:${String(feedbackEnabled)}`;

    if (redirectedKeyRef.current === effectKey) {
      return;
    }

    if (!feedbackEnabled) {
      redirectedKeyRef.current = effectKey;
      router.replace(
        buildReservationHistoryRedirectHref(
          fallbackRole,
          sanitizedSearchWhenDisabled
        ),
        { scroll: false }
      );
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

    void coordinator
      .resolveHistoryRedirect({
        userId,
        fallbackRole,
        rawSearch,
        signal: controller.signal,
        lookupSingleFeedback: fetchSingleReservationFeedback,
      })
      .then((resolved) => {
        if (cancelled || controller.signal.aborted) return;
        redirectedKeyRef.current = effectKey;
        router.replace(resolved.redirectHref, { scroll: false });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    coordinator,
    feedbackEnabled,
    rawSearch,
    router,
    session,
    status,
    targetReservationId,
  ]);
}
