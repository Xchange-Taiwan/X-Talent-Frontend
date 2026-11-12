'use client';

// Tracks initial page load + SPA route-change page_view events, per-page
// scroll_depth milestones (25/50/75/90), and declarative [data-analytics-click]
// interactions across the entire application.

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

export default function PageViewTracker() {
  const pathname = usePathname();
  const lastTrackedPathRef = useRef<string | null>(null);
  const lastProfileDocTitleRef = useRef<string | null>(null);
  const reachedThresholdsRef = useRef<Set<number>>(new Set());

  // 1. Initial load & SPA route-change page_view tracking (deduplicated against
  // React Strict Mode double-effect invocations on the same pathname).
  // Guards against stale dynamic /profile/[id] document.title leaking user names
  // when SPA-transitioning away before Next.js commits the next route's <title>.
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
      lastProfileDocTitleRef.current = currentDocTitle || null;
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

  // 2. Per-page scroll_depth observer: throttled via requestAnimationFrame,
  // emits unified `scroll_depth` events in ascending order for all newly crossed
  // milestones (25/50/75/90), detaches once 90% is reached, and resets on SPA navigation.
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

  // 3. Low-intrusiveness declarative click delegation via `data-analytics-click`
  // in capture phase so Radix Sheet/Popover/DropdownMenu items are captured before
  // portal close handlers mutate or unmount the DOM.
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

  return null;
}
