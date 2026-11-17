import { act, renderHook } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Reservation } from '@/types/reservation';

import {
  QUEUE_PROMOTE_MS,
  QUEUE_SWIPE_OUT_MS,
  useFeedbackQueueMotion,
} from './useFeedbackQueueMotion';

function makeReservation(id: string, name: string): Reservation {
  return fromPartial<Reservation>({
    id,
    name,
    date: '2026/10/20',
    time: '19:00–19:30',
  });
}

describe('useFeedbackQueueMotion', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('freezes queueItems while open even if parent mutates the queue prop mid-session', () => {
    const item1 = makeReservation('q-1', 'Emily');
    const item2 = makeReservation('q-2', 'Alex');
    const item3 = makeReservation('q-3', 'Sarah');

    const { result, rerender } = renderHook(
      ({ open, queue }) =>
        useFeedbackQueueMotion({
          open,
          isEditMode: false,
          reservation: queue[0] ?? item1,
          queue,
        }),
      {
        initialProps: {
          open: true,
          queue: [item1, item2, item3],
        },
      }
    );

    expect(result.current.isQueueMode).toBe(true);
    expect(result.current.queueItems.map((i) => i.id)).toEqual([
      'q-1',
      'q-2',
      'q-3',
    ]);
    expect(result.current.hasRemainingQueueCard).toBe(true);

    // Parent removes q-1 after optimistic cache update while dialog remains open
    rerender({
      open: true,
      queue: [item2, item3],
    });

    expect(result.current.queueItems.map((i) => i.id)).toEqual([
      'q-1',
      'q-2',
      'q-3',
    ]);
    expect(result.current.activeReservation.id).toBe('q-1');
  });

  it('runs swiping-out -> promoting -> idle timers and invokes call-time callbacks without render-mutated refs', () => {
    vi.useFakeTimers();

    const item1 = makeReservation('q-1', 'Emily');
    const item2 = makeReservation('q-2', 'Alex');
    const onSkipReservation = vi.fn();
    const onPromoteNextItem = vi.fn();
    const onFinishQueue = vi.fn();

    const { result } = renderHook(() =>
      useFeedbackQueueMotion({
        open: true,
        isEditMode: false,
        reservation: item1,
        queue: [item1, item2],
        onSkipReservation,
      })
    );

    act(() => {
      result.current.advanceOrCloseQueue({
        didSkip: true,
        onPromoteNextItem,
        onFinishQueue,
      });
    });

    expect(onSkipReservation).toHaveBeenCalledWith(item1);
    expect(result.current.queueMotionState).toBe('swiping-out');
    expect(result.current.isTransitioningCard).toBe(true);
    expect(onPromoteNextItem).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(QUEUE_SWIPE_OUT_MS);
    });

    expect(result.current.queueIndex).toBe(1);
    expect(result.current.activeReservation.id).toBe('q-2');
    expect(result.current.queueMotionState).toBe('promoting');
    expect(onPromoteNextItem).toHaveBeenCalledWith(item2, 1);

    act(() => {
      vi.advanceTimersByTime(QUEUE_PROMOTE_MS);
    });

    expect(result.current.queueMotionState).toBe('idle');
    expect(result.current.isTransitioningCard).toBe(false);
    expect(result.current.hasRemainingQueueCard).toBe(false);

    // Final card finishes immediately without swipe animation
    act(() => {
      result.current.advanceOrCloseQueue({
        didSkip: false,
        onPromoteNextItem,
        onFinishQueue,
      });
    });

    expect(onFinishQueue).toHaveBeenCalledTimes(1);
    expect(result.current.queueIndex).toBe(0);
  });

  it('batch-skips only remaining unaddressed items via skipRemainingQueue in create mode', () => {
    vi.useFakeTimers();

    const item1 = makeReservation('q-1', 'Emily');
    const item2 = makeReservation('q-2', 'Alex');
    const item3 = makeReservation('q-3', 'Sarah');
    const onSkipReservation = vi.fn();

    const { result } = renderHook(() =>
      useFeedbackQueueMotion({
        open: true,
        isEditMode: false,
        reservation: item1,
        queue: [item1, item2, item3],
        onSkipReservation,
      })
    );

    // Advance past item1 without skipping
    act(() => {
      result.current.advanceOrCloseQueue({
        didSkip: false,
        onPromoteNextItem: () => {},
        onFinishQueue: () => {},
      });
      vi.advanceTimersByTime(QUEUE_SWIPE_OUT_MS + QUEUE_PROMOTE_MS);
    });

    expect(result.current.queueIndex).toBe(1);

    act(() => {
      result.current.skipRemainingQueue();
    });

    expect(onSkipReservation.mock.calls.map(([r]) => r.id)).toEqual([
      'q-2',
      'q-3',
    ]);
  });
});
