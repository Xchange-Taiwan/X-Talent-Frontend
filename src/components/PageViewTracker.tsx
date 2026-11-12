'use client';

// Tracks initial page load + SPA route-change page_view events, per-page
// scroll_depth milestones (25/50/75/90), and declarative [data-analytics-click]
// button interactions across the entire application.

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import {
  getAnalyticsClickPayloadFromElement,
  SCROLL_DEPTH_THRESHOLDS,
  trackButtonClick,
  trackPageView,
  trackScrollDepth,
} from '@/lib/analytics';

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
  const reachedThresholdsRef = useRef<Set<number>>(new Set());

  // 1. Initial load & SPA route-change page_view tracking (deduplicated against
  // React Strict Mode double-effect invocations on the same pathname).
  useEffect(() => {
    if (!pathname || lastTrackedPathRef.current === pathname) return;
    lastTrackedPathRef.current = pathname;
    const rawSearch =
      typeof window !== 'undefined' ? window.location.search : '';
    trackPageView(`${pathname}${rawSearch}`);
  }, [pathname]);

  // 2. Per-page scroll_depth observer: throttled via requestAnimationFrame,
  // emits a single unified `scroll_depth` event with `percent_scrolled` for
  // the highest newly crossed milestone, and resets on SPA route transitions.
  useEffect(() => {
    if (!pathname || typeof window === 'undefined') return;

    reachedThresholdsRef.current = new Set();
    let rafId: number | null = null;

    const evaluateScrollDepth = () => {
      rafId = null;
      const percent = computeScrollPercent();
      if (percent === null) return;

      let highestNewThreshold: number | null = null;
      for (const threshold of SCROLL_DEPTH_THRESHOLDS) {
        if (
          percent >= threshold &&
          !reachedThresholdsRef.current.has(threshold)
        ) {
          reachedThresholdsRef.current.add(threshold);
          highestNewThreshold = threshold;
        }
      }

      if (highestNewThreshold !== null) {
        trackScrollDepth(highestNewThreshold, pathname);
      }
    };

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(evaluateScrollDepth);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [pathname]);

  // 3. Low-intrusiveness declarative button/link click delegation via
  // `data-analytics-click` attributes (works across both Server and Client Components).
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleDocumentClick = (event: MouseEvent) => {
      const payload = getAnalyticsClickPayloadFromElement(event.target);
      if (payload) {
        trackButtonClick(payload);
      }
    };

    document.addEventListener('click', handleDocumentClick, { passive: true });
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

  return null;
}
