import * as React from 'react';

interface UseLeftSwipeDismissOptions {
  onDismiss: () => void;
  threshold?: number;
  moveBuffer?: number;
}

// Reusable left-swipe-to-dismiss gesture, built directly on Pointer Events.
// Radix's own swipe-to-dismiss (used by our Toast) only supports a single,
// provider-wide direction, so this fills the gap for components that need
// the opposite direction alongside it. Bind the returned handlers via the
// *Capture props so they run independent of whatever the element's own
// (non-capture) pointer handlers do.
export function useLeftSwipeDismiss({
  onDismiss,
  threshold = 50,
  moveBuffer = 10,
}: UseLeftSwipeDismissOptions) {
  const swipeStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const isSwipingLeftRef = React.useRef(false);

  const resetSwipeState = (target: HTMLElement) => {
    target.style.removeProperty('--radix-toast-swipe-move-x');
    target.setAttribute('data-swipe', 'cancel');
    swipeStartRef.current = null;
    isSwipingLeftRef.current = false;
  };

  const onPointerDownCapture = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    swipeStartRef.current = { x: event.clientX, y: event.clientY };
    isSwipingLeftRef.current = false;
  };

  const onPointerMoveCapture = (event: React.PointerEvent) => {
    if (!swipeStartRef.current) return;

    const x = event.clientX - swipeStartRef.current.x;
    const y = event.clientY - swipeStartRef.current.y;
    const target = event.currentTarget as HTMLElement;

    if (!isSwipingLeftRef.current) {
      const isPastBuffer =
        Math.abs(x) >= moveBuffer || Math.abs(y) >= moveBuffer;
      if (!isPastBuffer) return;

      const isLeftSwipe = x < 0 && Math.abs(x) >= Math.abs(y);
      if (!isLeftSwipe) {
        // The first movement past the buffer wasn't a left swipe (it's
        // vertical, or rightward) — stop tracking this gesture for good
        // instead of re-checking on every later move, which could hijack a
        // scroll or a right-swipe the moment it happens to drift left.
        swipeStartRef.current = null;
        return;
      }

      isSwipingLeftRef.current = true;
      // Keep receiving events for this pointer even if it leaves the
      // element's bounds mid-drag, so a fast swipe can't end without a
      // matching pointerup ever reaching us.
      target.setPointerCapture(event.pointerId);
    }

    target.setAttribute('data-swipe', 'move');
    // Direct DOM writes (not React state) are deliberate here: pointermove
    // fires far too often for a re-render per event, and this mirrors
    // Radix's own swipe-to-dismiss, which drives the same CSS variables the
    // same way for its native right-swipe handling.
    target.style.setProperty('--radix-toast-swipe-move-x', `${x}px`);
  };

  const onPointerUpCapture = (event: React.PointerEvent) => {
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }

    if (!isSwipingLeftRef.current) {
      swipeStartRef.current = null;
      return;
    }

    const x = swipeStartRef.current
      ? event.clientX - swipeStartRef.current.x
      : 0;

    // Only a leftward release past the threshold dismisses — checking
    // Math.abs(x) alone would also fire if the drag was pulled back past
    // the start point and off to the right.
    if (x <= -threshold) {
      target.style.removeProperty('--radix-toast-swipe-move-x');
      target.style.setProperty('--radix-toast-swipe-end-x', `${x}px`);
      target.setAttribute('data-swipe', 'end');
      swipeStartRef.current = null;
      isSwipingLeftRef.current = false;
      onDismiss();
    } else {
      resetSwipeState(target);
    }
  };

  // A touch drag can be interrupted by the OS/browser (e.g. an edge-swipe
  // back gesture or an incoming call) before a pointerup ever fires. Without
  // this, the toast would be left stuck mid-drag with no way to recover.
  const onPointerCancelCapture = (event: React.PointerEvent) => {
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    resetSwipeState(target);
  };

  return {
    onPointerDownCapture,
    onPointerMoveCapture,
    onPointerUpCapture,
    onPointerCancelCapture,
  };
}
