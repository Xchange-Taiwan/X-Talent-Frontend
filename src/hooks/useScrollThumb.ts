import * as React from 'react';

const SCROLL_THUMB_MIN_HEIGHT = 24;
const SCROLL_THUMB_HIDE_DELAY = 1000;

export type ScrollThumbState = {
  /** Whether the content actually overflows (whether to render at all). */
  visible: boolean;
  /** Whether the thumb should currently be opaque (hover or recent scroll). */
  active: boolean;
  top: number;
  height: number;
};

export type ScrollThumbHandlers = {
  trackRefCallback: React.RefCallback<HTMLDivElement>;
  scrollRefCallback: React.RefCallback<HTMLDivElement>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

/**
 * Tracks scroll position on the scrollable list and derives a thumb
 * top/height mapped onto the height of a larger "track" element (e.g.
 * a card with a static header above the scrollable region), so a
 * custom (non-native) scrollbar indicator can be rendered spanning
 * from the very top of the track. Native `::-webkit-scrollbar-*`
 * overrides are unreliable on some current Windows Chromium builds
 * (Fluent scrollbars can ignore `::-webkit-scrollbar-button { display:
 * none }`), so this sidesteps native scrollbar rendering entirely.
 *
 * The thumb fades out after a period of no hover/scroll activity, and
 * reappears on hover or scroll, matching overlay-scrollbar conventions.
 *
 * Uses callback refs rather than plain `useRef` + `useEffect`: content
 * can render inside a portal (e.g. a Radix `Popover`), which may mount
 * on a different timing than the parent's own effect cycle. A callback
 * ref is guaranteed by React to fire exactly when its DOM node
 * mounts/unmounts, regardless of that.
 */
export function useScrollThumb(): [ScrollThumbHandlers, ScrollThumbState] {
  const [geometry, setGeometry] = React.useState<
    Omit<ScrollThumbState, 'active'>
  >({ visible: false, top: 0, height: 0 });
  const [active, setActive] = React.useState(false);

  const trackElRef = React.useRef<HTMLDivElement | null>(null);
  const scrollElRef = React.useRef<HTMLDivElement | null>(null);
  const cleanupRef = React.useRef<(() => void) | null>(null);
  const hideTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const rafRef = React.useRef<number | null>(null);
  const isHoveredRef = React.useRef(false);
  const wasOverflowingRef = React.useRef(false);

  const scheduleHide = React.useCallback(() => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      if (!isHoveredRef.current) setActive(false);
    }, SCROLL_THUMB_HIDE_DELAY);
  }, []);

  const onMouseEnter = React.useCallback(() => {
    isHoveredRef.current = true;
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    setActive(true);
  }, []);

  const onMouseLeave = React.useCallback(() => {
    isHoveredRef.current = false;
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    setActive(false);
  }, []);

  const recompute = React.useCallback(() => {
    const trackEl = trackElRef.current;
    const scrollEl = scrollElRef.current;
    if (!trackEl || !scrollEl) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollEl;
    const isOverflowing = scrollHeight > clientHeight;

    if (!isOverflowing) {
      wasOverflowingRef.current = false;
      setGeometry({ visible: false, top: 0, height: 0 });
      return;
    }

    const trackHeight = trackEl.clientHeight;
    const height = Math.max(
      (clientHeight / scrollHeight) * trackHeight,
      SCROLL_THUMB_MIN_HEIGHT
    );
    const maxTop = trackHeight - height;
    const scrollableDistance = scrollHeight - clientHeight;
    const top =
      scrollableDistance > 0 ? (scrollTop / scrollableDistance) * maxTop : 0;
    setGeometry({ visible: true, top, height });

    // Briefly reveal as an affordance the first time content becomes
    // scrollable (e.g. right when the popover opens).
    if (!wasOverflowingRef.current) {
      wasOverflowingRef.current = true;
      setActive(true);
      scheduleHide();
    }
  }, [scheduleHide]);

  const attachListeners = React.useCallback(() => {
    const trackEl = trackElRef.current;
    const scrollEl = scrollElRef.current;
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (!trackEl || !scrollEl) {
      // The scrollable content unmounted (e.g. a status change swapped
      // it out for a loading/empty state) — hide any stale thumb
      // instead of leaving it floating at its last position.
      wasOverflowingRef.current = false;
      isHoveredRef.current = false;
      setGeometry({ visible: false, top: 0, height: 0 });
      return;
    }

    const handleScroll = () => {
      // Scroll can fire far more often than the display refreshes;
      // collapse bursts to at most one state update per frame instead
      // of re-rendering on every event.
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        recompute();
        setActive(true);
        scheduleHide();
      });
    };

    recompute();
    scrollEl.addEventListener('scroll', handleScroll, { passive: true });

    // jsdom (unit tests) doesn't implement ResizeObserver.
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(recompute)
        : null;
    resizeObserver?.observe(trackEl);
    resizeObserver?.observe(scrollEl);

    cleanupRef.current = () => {
      scrollEl.removeEventListener('scroll', handleScroll);
      resizeObserver?.disconnect();
    };
  }, [recompute, scheduleHide]);

  const trackRefCallback = React.useCallback(
    (el: HTMLDivElement | null) => {
      trackElRef.current = el;
      attachListeners();
    },
    [attachListeners]
  );

  const scrollRefCallback = React.useCallback(
    (el: HTMLDivElement | null) => {
      scrollElRef.current = el;
      attachListeners();
    },
    [attachListeners]
  );

  React.useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return [
    { trackRefCallback, scrollRefCallback, onMouseEnter, onMouseLeave },
    { ...geometry, active },
  ];
}
