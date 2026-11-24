'use client';

// Single thin React / DOM adapter for site-wide telemetry (X-Tracker #979).
//
// All session identity transitions (GA4 / Clarity / Sentry) and the
// `/profile/[id]` `document.title` masking state machine live in the
// framework-free `telemetrySessionCoordinator`. This component only:
//   1. feeds `useSession()` / `usePathname()` into the coordinator and wires
//      the `<title>` `MutationObserver` + DOM read ports
//   2. `useScrollDepthTracking` - rAF-throttled `scroll_depth` milestones
//      (25/50/75/100) that emit every crossed threshold in ascending order
//      and detach once 100% is reached
//   3. `useAnalyticsClickDelegation` - capture-phase `[data-analytics-click]`
//      delegation across the document

import * as Sentry from '@sentry/nextjs';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import {
  getAnalyticsClickPayloadFromElement,
  SCROLL_DEPTH_THRESHOLDS,
  setAnalyticsUserContext,
  trackButtonClick,
  trackPageView,
  trackScrollDepth,
} from '@/lib/analytics';
import {
  createTelemetrySessionCoordinator,
  type TelemetrySessionCoordinator,
  type TelemetrySinkFailure,
} from '@/lib/telemetrySessionCoordinator';

export { INITIAL_SESSION_RESOLVE_TIMEOUT_MS } from '@/lib/telemetrySessionCoordinator';

export interface PageViewTrackerProps {
  /** Optional GA4 Measurement ID override (defaults to active AnalyticsBootstrap ID or NEXT_PUBLIC_GA_ID). */
  gaId?: string;
}

const MAX_SCROLL_THRESHOLD =
  SCROLL_DEPTH_THRESHOLDS[SCROLL_DEPTH_THRESHOLDS.length - 1];

function computeScrollPercent(): number | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }
  const doc = document.documentElement;
  const scrollableHeight = doc.scrollHeight - window.innerHeight;
  if (scrollableHeight <= 0) {
    return null;
  }
  const scrollTop = Math.max(0, window.scrollY || doc.scrollTop || 0);
  return Math.min(100, Math.round((scrollTop / scrollableHeight) * 100));
}

function reportSinkFailure({ sink, operation }: TelemetrySinkFailure): void {
  // Only the sink + operation names are logged: never the session payload.
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[telemetry] ${sink}.${operation} sink failed`);
  }
}

function createBrowserTelemetryCoordinator(
  gaId: string | undefined
): TelemetrySessionCoordinator {
  const gaOptions = gaId ? { gaId } : undefined;
  return createTelemetrySessionCoordinator({
    analytics: {
      setUserContext: (identity) =>
        setAnalyticsUserContext(identity, gaOptions),
      trackPageView: (path, options) => trackPageView(path, options),
    },
    sentry: {
      setUser: (user) => Sentry.setUser(user),
      setUserRoleTag: (userRole) => Sentry.setTag('user_role', userRole),
    },
    document: {
      readTitle: () => (typeof document !== 'undefined' ? document.title : ''),
      readLivePathname: () =>
        typeof window !== 'undefined' && window.location?.pathname
          ? window.location.pathname
          : null,
      readSearch: () =>
        typeof window !== 'undefined' ? window.location.search : '',
    },
    onSinkFailure: reportSinkFailure,
  });
}

function useScrollDepthTracking(pathname: string | null): void {
  useEffect(() => {
    if (!pathname || typeof window === 'undefined') return;

    const reachedThresholds = new Set<number>();
    let rafId: number | null = null;
    let isDetached = false;

    const detachScrollListener = () => {
      if (isDetached) return;
      isDetached = true;
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const evaluateScrollDepth = () => {
      const percent = computeScrollPercent();
      if (percent === null) return;

      for (const threshold of SCROLL_DEPTH_THRESHOLDS) {
        if (percent >= threshold && !reachedThresholds.has(threshold)) {
          reachedThresholds.add(threshold);
          trackScrollDepth(threshold, pathname);
        }
      }

      if (reachedThresholds.has(MAX_SCROLL_THRESHOLD)) {
        detachScrollListener();
      }
    };

    function handleScroll() {
      if (isDetached || rafId !== null) return;
      let syncCompleted = false;
      const scheduledId = window.requestAnimationFrame(() => {
        syncCompleted = true;
        rafId = null;
        evaluateScrollDepth();
      });
      if (!syncCompleted && !isDetached) {
        rafId = scheduledId;
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      detachScrollListener();
    };
  }, [pathname]);
}

function useAnalyticsClickDelegation(): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleDocumentClick = (event: MouseEvent) => {
      const payload = getAnalyticsClickPayloadFromElement(event.target);
      if (payload) {
        trackButtonClick(payload);
      }
    };

    document.addEventListener('click', handleDocumentClick, {
      capture: true,
      passive: true,
    });
    return () => {
      document.removeEventListener('click', handleDocumentClick, {
        capture: true,
      });
    };
  }, []);
}

export default function PageViewTracker({
  gaId,
}: PageViewTrackerProps = {}): null {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [coordinator] = useState(() => createBrowserTelemetryCoordinator(gaId));

  const rawUserId = session?.user?.id;
  const isMentor = session?.user?.isMentor;
  const sessionError = session?.error;

  // Session identity first: the coordinator binds GA4 / Sentry identity before
  // releasing any deferred page_view, independent of effect ordering.
  useEffect(() => {
    coordinator.updateSession({
      status,
      userId: rawUserId,
      isMentor,
      error: sessionError,
    });
    return () => {
      coordinator.dispose();
    };
  }, [coordinator, isMentor, rawUserId, sessionError, status]);

  useEffect(() => {
    if (!pathname || typeof document === 'undefined') return;

    coordinator.enterRoute(pathname);

    const observer =
      typeof MutationObserver !== 'undefined' && document.head
        ? new MutationObserver(() => coordinator.observeTitle())
        : null;
    observer?.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer?.disconnect();
      coordinator.leaveRoute(pathname);
    };
  }, [coordinator, pathname]);

  useScrollDepthTracking(pathname);
  useAnalyticsClickDelegation();

  return null;
}
