'use client';

// Coordinates GA4 / Clarity behavioral tracking across the application via
// three focused internal hooks:
//   1. `usePageViewTracking` — initial load + SPA route-change `page_view`
//      with async `/profile/[id]` title observation so user names never leak
//   2. `useScrollDepthTracking` — rAF-throttled `scroll_depth` milestones
//      (25/50/75/100) that emit every crossed threshold in ascending order
//      and detach once 100% is reached
//   3. `useAnalyticsClickDelegation` — capture-phase `[data-analytics-click]`
//      delegation across the document

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import {
  getAnalyticsClickPayloadFromElement,
  isUserProfilePath,
  SCROLL_DEPTH_THRESHOLDS,
  trackButtonClick,
  trackPageView,
  trackScrollDepth,
} from '@/lib/analytics';

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

function usePageViewTracking(pathname: string | null): void {
  const lastTrackedPathRef = useRef<string | null>(null);
  const lastProfileDocTitleRef = useRef<string | null>(null);

  // Track async `<title>` streaming updates while the viewer is on `/profile/[id]`
  // so subsequent SPA navigations away from a profile page can reliably detect
  // and redact stale real-name titles before Next.js commits the next `<title>`.
  useEffect(() => {
    if (
      !pathname ||
      !isUserProfilePath(pathname) ||
      typeof document === 'undefined'
    ) {
      return;
    }

    const entryTitle = document.title;

    const syncProfileTitle = () => {
      if (
        typeof window !== 'undefined' &&
        !isUserProfilePath(window.location.pathname)
      ) {
        return;
      }
      const nextTitle = document.title;
      if (nextTitle && nextTitle !== entryTitle) {
        lastProfileDocTitleRef.current = nextTitle;
      }
    };

    const observer =
      typeof MutationObserver !== 'undefined' && document.head
        ? new MutationObserver(syncProfileTitle)
        : null;

    observer?.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer?.disconnect();
      if (
        lastProfileDocTitleRef.current === null &&
        document.title &&
        document.title !== entryTitle
      ) {
        lastProfileDocTitleRef.current = document.title;
      }
    };
  }, [pathname]);

  useEffect(() => {
    if (!pathname || lastTrackedPathRef.current === pathname) return;

    const previousPath = lastTrackedPathRef.current;
    lastTrackedPathRef.current = pathname;

    const currentDocTitle =
      typeof document !== 'undefined' ? document.title : '';
    const isNowProfile = isUserProfilePath(pathname);
    const wasPrevProfile = previousPath
      ? isUserProfilePath(previousPath)
      : false;

    if (isNowProfile) {
      // On initial hard-load directly onto `/profile/[id]`, capture the SSR title immediately;
      // on SPA entry from another route, wait for the async `<title>` observer above so we
      // don't mistake the previous page's title for a profile name title.
      lastProfileDocTitleRef.current =
        previousPath === null ? currentDocTitle || null : null;
    }

    const hasStaleProfileTitle =
      !isNowProfile &&
      wasPrevProfile &&
      Boolean(currentDocTitle) &&
      currentDocTitle === lastProfileDocTitleRef.current;

    if (!isNowProfile) {
      lastProfileDocTitleRef.current = null;
    }

    const rawSearch =
      typeof window !== 'undefined' ? window.location.search : '';
    trackPageView(
      `${pathname}${rawSearch}`,
      hasStaleProfileTitle ? { title: '' } : undefined
    );
  }, [pathname]);
}

function useScrollDepthTracking(pathname: string | null): void {
  const reachedThresholdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!pathname || typeof window === 'undefined') return;

    reachedThresholdsRef.current = new Set();
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
        if (
          percent >= threshold &&
          !reachedThresholdsRef.current.has(threshold)
        ) {
          reachedThresholdsRef.current.add(threshold);
          trackScrollDepth(threshold, pathname);
        }
      }

      if (reachedThresholdsRef.current.has(MAX_SCROLL_THRESHOLD)) {
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

export default function PageViewTracker(): null {
  const pathname = usePathname();

  usePageViewTracking(pathname);
  useScrollDepthTracking(pathname);
  useAnalyticsClickDelegation();

  return null;
}
