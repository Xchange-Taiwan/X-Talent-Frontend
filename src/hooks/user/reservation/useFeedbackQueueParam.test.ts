import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const { feedbackNavigationMockFactory } =
    await import('@/test/mocks/reservationFeedbackHarness');
  return feedbackNavigationMockFactory();
});

import {
  feedbackRouteMock,
  makeFeedbackTestReservation,
  resetFeedbackHookTestState,
  setMockFeedbackRoute,
} from '@/test/mocks/reservationFeedbackHarness';

import {
  useFeedbackQueueParam,
  type UseFeedbackQueueParamOptions,
} from './useFeedbackQueueParam';

describe('useFeedbackQueueParam', () => {
  beforeEach(() => {
    resetFeedbackHookTestState({
      pathname: '/reservation/mentee',
      query: 'feedback=queue',
    });
  });

  it('latches pending ANSWER items once history loads and preserves snapshot when background refetch empties history', () => {
    const item1 = makeFeedbackTestReservation('res-1');
    const item2 = makeFeedbackTestReservation('res-2');

    const initialProps: UseFeedbackQueueParamOptions = {
      isMentee: true,
      history: [],
      isHistoryLoaded: false,
      isLoadingHistory: true,
      isLoadingUpcoming: false,
      isLoadingPending: false,
    };

    const { result, rerender } = renderHook(
      (props: UseFeedbackQueueParamOptions) => useFeedbackQueueParam(props),
      { initialProps }
    );

    expect(result.current.isFeedbackQueueRequested).toBe(true);
    expect(result.current.feedbackQueueItems).toBeNull();
    expect(feedbackRouteMock.replace).not.toHaveBeenCalled();

    rerender({
      ...initialProps,
      history: [item1, item2],
      isHistoryLoaded: true,
      isLoadingHistory: false,
    });

    expect(result.current.feedbackQueueItems).toEqual([item1, item2]);
    expect(feedbackRouteMock.replace).not.toHaveBeenCalled();

    // Background refetch emptying history keeps latched queue intact until explicit dismiss
    rerender({
      ...initialProps,
      history: [],
      isHistoryLoaded: true,
      isLoadingHistory: false,
    });

    expect(result.current.feedbackQueueItems).toEqual([item1, item2]);
    expect(feedbackRouteMock.replace).not.toHaveBeenCalled();

    act(() => {
      result.current.dismissFeedbackQueue();
    });

    expect(result.current.feedbackQueueItems).toBeNull();
    expect(feedbackRouteMock.replace).toHaveBeenCalledWith(
      '/reservation/mentee',
      { scroll: false }
    );
  });

  it('strips feedback=queue preserving other query params when mentee history finishes loading with 0 pending items', () => {
    setMockFeedbackRoute('/reservation/mentee', 'tab=upcoming&feedback=queue');

    const { rerender } = renderHook(
      (props: UseFeedbackQueueParamOptions) => useFeedbackQueueParam(props),
      {
        initialProps: {
          isMentee: true,
          history: [],
          isHistoryLoaded: false,
          isLoadingHistory: true,
          isLoadingUpcoming: false,
          isLoadingPending: false,
        },
      }
    );

    expect(feedbackRouteMock.replace).not.toHaveBeenCalled();

    rerender({
      isMentee: true,
      history: [],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      isLoadingUpcoming: false,
      isLoadingPending: false,
    });

    expect(feedbackRouteMock.replace).toHaveBeenCalledWith(
      '/reservation/mentee?tab=upcoming',
      { scroll: false }
    );
  });

  it('supports bilateral mentor ?feedback=queue ordered oldest-first and persists skipped sessions via coordinator (#906)', () => {
    setMockFeedbackRoute('/reservation/mentor', 'feedback=queue');

    const newer = makeFeedbackTestReservation('mentor-res-2', {
      dtend: 1762000000,
    });
    const older = makeFeedbackTestReservation('mentor-res-1', {
      dtend: 1760000000,
    });

    const { result, unmount } = renderHook(() =>
      useFeedbackQueueParam({
        isMentee: false,
        role: 'mentor',
        userId: 'mentor-99',
        history: [newer, older],
        isHistoryLoaded: true,
        isLoadingHistory: false,
        isLoadingUpcoming: false,
        isLoadingPending: false,
      })
    );

    expect(result.current.isFeedbackQueueRequested).toBe(true);
    expect(result.current.feedbackQueueItems?.map((i) => i.id)).toEqual([
      'mentor-res-1',
      'mentor-res-2',
    ]);
    expect(feedbackRouteMock.replace).not.toHaveBeenCalled();

    act(() => {
      result.current.skipFeedbackQueueItem(older);
    });
    unmount();

    const { result: secondMount } = renderHook(() =>
      useFeedbackQueueParam({
        role: 'mentor',
        userId: 'mentor-99',
        history: [newer, older],
        isHistoryLoaded: true,
        isLoadingHistory: false,
        isLoadingUpcoming: false,
        isLoadingPending: false,
      })
    );
    expect(secondMount.current.feedbackQueueItems?.map((i) => i.id)).toEqual([
      'mentor-res-2',
    ]);
  });
});
