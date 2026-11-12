'use client';

import * as React from 'react';

import type { Reservation } from '@/types/reservation';

export type QueueMotionState = 'idle' | 'swiping-out' | 'promoting';

export const QUEUE_SWIPE_OUT_MS = 260;
export const QUEUE_PROMOTE_MS = 360;

export function isReducedMotionPreferred(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function buildQueueList(
  isEditMode: boolean,
  reservation: Reservation,
  queue?: Reservation[]
): Reservation[] {
  if (!isEditMode && queue && queue.length > 0) {
    return [...queue];
  }
  return [reservation];
}

function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(0, index), Math.max(0, length - 1));
}

export interface UseFeedbackQueueMotionOptions {
  open: boolean;
  isEditMode: boolean;
  reservation: Reservation;
  queue?: Reservation[];
  initialQueueIndex?: number;
  onSkipReservation?: (reservation: Reservation) => void;
  onAdvanceItem: () => void;
  onFinishQueue: () => void;
}

export function useFeedbackQueueMotion({
  open,
  isEditMode,
  reservation,
  queue,
  initialQueueIndex = 0,
  onSkipReservation,
  onAdvanceItem,
  onFinishQueue,
}: UseFeedbackQueueMotionOptions) {
  const liveQueueItems = React.useMemo(
    () => buildQueueList(isEditMode, reservation, queue),
    [isEditMode, queue, reservation]
  );

  // Freeze queue snapshot while dialog is open so parent cache updates
  // (removing submitted/skipped reservations from `queue` prop) never shift
  // indices, skip items, or shrink the progress denominator mid-flow.
  const [sessionQueue, setSessionQueue] = React.useState<Reservation[]>(() =>
    buildQueueList(isEditMode, reservation, queue)
  );
  const [queueIndex, setQueueIndex] = React.useState(() =>
    clampIndex(initialQueueIndex, liveQueueItems.length)
  );
  const [queueMotionState, setQueueMotionState] =
    React.useState<QueueMotionState>('idle');

  const queueTimersRef = React.useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const wasOpenRef = React.useRef(open);

  const clearQueueTimers = React.useCallback(() => {
    for (const timer of queueTimersRef.current) {
      clearTimeout(timer);
    }
    queueTimersRef.current = [];
  }, []);

  React.useEffect(() => {
    return () => {
      clearQueueTimers();
    };
  }, [clearQueueTimers]);

  // Sync external queue only while closed, or at the exact moment `open` flips false -> true.
  React.useEffect(() => {
    const openedNow = open && !wasOpenRef.current;
    wasOpenRef.current = open;

    if (!open || openedNow) {
      setSessionQueue(liveQueueItems);
      setQueueIndex(clampIndex(initialQueueIndex, liveQueueItems.length));
    }
  }, [open, liveQueueItems, initialQueueIndex]);

  const queueItems = open ? sessionQueue : liveQueueItems;
  const isQueueMode = !isEditMode && queueItems.length > 1;
  const activeReservation =
    queueItems[clampIndex(queueIndex, queueItems.length)] ?? reservation;
  const hasRemainingQueueCard =
    isQueueMode && queueIndex < queueItems.length - 1;

  const prepareOpenSnapshot = React.useCallback(() => {
    const snapshot = buildQueueList(isEditMode, reservation, queue);
    setSessionQueue(snapshot);
    setQueueIndex(clampIndex(initialQueueIndex, snapshot.length));
    setQueueMotionState('idle');
  }, [initialQueueIndex, isEditMode, queue, reservation]);

  const resetQueueOnClose = React.useCallback(() => {
    clearQueueTimers();
    setQueueMotionState('idle');
    setQueueIndex(clampIndex(initialQueueIndex, liveQueueItems.length));
  }, [clearQueueTimers, initialQueueIndex, liveQueueItems.length]);

  const advanceOrCloseQueue = React.useCallback(
    (didSkip: boolean) => {
      if (didSkip) {
        onSkipReservation?.(activeReservation);
      }

      if (!isQueueMode || queueIndex >= queueItems.length - 1) {
        clearQueueTimers();
        setQueueMotionState('idle');
        setQueueIndex(0);
        onFinishQueue();
        return;
      }

      if (isReducedMotionPreferred()) {
        setQueueIndex((prev) => Math.min(prev + 1, queueItems.length - 1));
        onAdvanceItem();
        setQueueMotionState('idle');
        return;
      }

      clearQueueTimers();
      setQueueMotionState('swiping-out');

      const outTimer = setTimeout(() => {
        setQueueIndex((prev) => Math.min(prev + 1, queueItems.length - 1));
        onAdvanceItem();
        setQueueMotionState('promoting');

        const promoteTimer = setTimeout(() => {
          setQueueMotionState('idle');
        }, QUEUE_PROMOTE_MS);
        queueTimersRef.current.push(promoteTimer);
      }, QUEUE_SWIPE_OUT_MS);

      queueTimersRef.current.push(outTimer);
    },
    [
      activeReservation,
      clearQueueTimers,
      isQueueMode,
      onAdvanceItem,
      onFinishQueue,
      onSkipReservation,
      queueIndex,
      queueItems.length,
    ]
  );

  return {
    queueItems,
    queueIndex,
    isQueueMode,
    activeReservation,
    hasRemainingQueueCard,
    queueMotionState,
    isTransitioningCard: queueMotionState !== 'idle',
    prepareOpenSnapshot,
    resetQueueOnClose,
    advanceOrCloseQueue,
  };
}
