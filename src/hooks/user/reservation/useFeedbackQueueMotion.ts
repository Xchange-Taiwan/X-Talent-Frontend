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
}

export interface AdvanceFeedbackQueueOptions {
  didSkip: boolean;
  onPromoteNextItem: (nextReservation: Reservation, nextIndex: number) => void;
  onFinishQueue: () => void;
}

export function useFeedbackQueueMotion({
  open,
  isEditMode,
  reservation,
  queue,
  initialQueueIndex = 0,
  onSkipReservation,
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

  // Freeze external queue at the exact moment `open` transitions false -> true.
  // While closed (`!open`), `queueItems` reads `liveQueueItems` directly without
  // triggering state updates on inline array props.
  React.useEffect(() => {
    const openedNow = open && !wasOpenRef.current;
    wasOpenRef.current = open;

    if (openedNow) {
      setSessionQueue(liveQueueItems);
      setQueueIndex(clampIndex(initialQueueIndex, liveQueueItems.length));
    }
  }, [open, liveQueueItems, initialQueueIndex]);

  const queueItems = open ? sessionQueue : liveQueueItems;
  const clampedIndex = clampIndex(queueIndex, queueItems.length);
  const isQueueMode = !isEditMode && queueItems.length > 1;
  const activeReservation = queueItems[clampedIndex] ?? reservation;
  const hasRemainingQueueCard =
    isQueueMode && clampedIndex < queueItems.length - 1;

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

  const skipRemainingQueue = React.useCallback(() => {
    if (isEditMode || !onSkipReservation) {
      return;
    }
    for (const item of queueItems.slice(clampedIndex)) {
      onSkipReservation(item);
    }
  }, [clampedIndex, isEditMode, onSkipReservation, queueItems]);

  const advanceOrCloseQueue = React.useCallback(
    ({
      didSkip,
      onPromoteNextItem,
      onFinishQueue,
    }: AdvanceFeedbackQueueOptions) => {
      if (didSkip) {
        onSkipReservation?.(activeReservation);
      }

      if (!isQueueMode || clampedIndex >= queueItems.length - 1) {
        clearQueueTimers();
        setQueueMotionState('idle');
        setQueueIndex(0);
        onFinishQueue();
        return;
      }

      const nextIndex = Math.min(clampedIndex + 1, queueItems.length - 1);
      const nextReservation = queueItems[nextIndex] ?? activeReservation;

      if (isReducedMotionPreferred()) {
        setQueueIndex(nextIndex);
        onPromoteNextItem(nextReservation, nextIndex);
        setQueueMotionState('idle');
        return;
      }

      clearQueueTimers();
      setQueueMotionState('swiping-out');

      const outTimer = setTimeout(() => {
        setQueueIndex(nextIndex);
        onPromoteNextItem(nextReservation, nextIndex);
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
      clampedIndex,
      clearQueueTimers,
      isQueueMode,
      onSkipReservation,
      queueItems,
    ]
  );

  return {
    queueItems,
    queueIndex: clampedIndex,
    isQueueMode,
    activeReservation,
    hasRemainingQueueCard,
    queueMotionState,
    isTransitioningCard: queueMotionState !== 'idle',
    prepareOpenSnapshot,
    resetQueueOnClose,
    skipRemainingQueue,
    advanceOrCloseQueue,
  };
}
