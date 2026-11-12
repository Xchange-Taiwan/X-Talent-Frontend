import { act, renderHook } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Reservation } from '@/types/reservation';

import {
  useFeedbackQueueParam,
  type UseFeedbackQueueParamOptions,
} from './useFeedbackQueueParam';

const mockReplace = vi.fn();
const mockGet = vi.fn<(key: string) => string | null>();
const mockToString = vi.fn<() => string>();
const mockPathname = vi.fn<() => string>();

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => mockGet(key),
    toString: () => mockToString(),
  }),
  useRouter: () => ({
    replace: (url: string, opts?: { scroll?: boolean }) =>
      mockReplace(url, opts),
  }),
  usePathname: () => mockPathname(),
}));

function makePendingAnswerReservation(id: string): Reservation {
  return fromPartial<Reservation>({
    id,
    cancelledBy: undefined,
    feedback: {
      meetingHappened: null,
      rating: null,
      nextStep: 'ANSWER',
    },
  });
}

describe('useFeedbackQueueParam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue('/reservation/mentee');
    mockGet.mockImplementation((key) => (key === 'feedback' ? 'queue' : null));
    mockToString.mockReturnValue('feedback=queue');
  });

  it('latches pending ANSWER items once history loads and preserves snapshot when background refetch empties history', () => {
    const item1 = makePendingAnswerReservation('res-1');
    const item2 = makePendingAnswerReservation('res-2');

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
    expect(mockReplace).not.toHaveBeenCalled();

    // History finishes loading with 2 pending ANSWER items -> latches snapshot
    rerender({
      ...initialProps,
      history: [item1, item2],
      isHistoryLoaded: true,
      isLoadingHistory: false,
    });

    expect(result.current.feedbackQueueItems).toEqual([item1, item2]);
    expect(mockReplace).not.toHaveBeenCalled();

    // Background refetch after submitting final item shrinks history to 0 pending items -> must NOT prematurely clear URL or unmount queue before dismissFeedbackQueue
    rerender({
      ...initialProps,
      history: [],
      isHistoryLoaded: true,
      isLoadingHistory: false,
    });

    expect(result.current.feedbackQueueItems).toEqual([item1, item2]);
    expect(mockReplace).not.toHaveBeenCalled();

    // Explicit dismiss clears queue and removes feedback=queue query param
    act(() => {
      result.current.dismissFeedbackQueue();
    });

    expect(result.current.feedbackQueueItems).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/reservation/mentee', {
      scroll: false,
    });
  });

  it('strips feedback=queue preserving other query params when mentee history finishes loading with 0 pending items', () => {
    mockGet.mockImplementation((key) => {
      if (key === 'feedback') return 'queue';
      if (key === 'tab') return 'upcoming';
      return null;
    });
    mockToString.mockReturnValue('tab=upcoming&feedback=queue');

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

    expect(mockReplace).not.toHaveBeenCalled();

    rerender({
      isMentee: true,
      history: [],
      isHistoryLoaded: true,
      isLoadingHistory: false,
      isLoadingUpcoming: false,
      isLoadingPending: false,
    });

    expect(mockReplace).toHaveBeenCalledWith(
      '/reservation/mentee?tab=upcoming',
      { scroll: false }
    );
  });

  it('strips feedback=queue immediately when user is not mentee', () => {
    mockPathname.mockReturnValue('/reservation/mentor');

    const { result } = renderHook(() =>
      useFeedbackQueueParam({
        isMentee: false,
        history: [makePendingAnswerReservation('res-1')],
        isHistoryLoaded: true,
        isLoadingHistory: false,
        isLoadingUpcoming: false,
        isLoadingPending: false,
      })
    );

    expect(result.current.isFeedbackQueueRequested).toBe(false);
    expect(result.current.feedbackQueueItems).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/reservation/mentor', {
      scroll: false,
    });
  });
});
