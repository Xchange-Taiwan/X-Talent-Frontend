import { renderHook, waitFor } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockReplace = vi.fn();
const mockUseRouter = vi.fn();
const mockFetchAllReservationsForState =
  vi.fn<(opts: FetchAllReservationsOptions) => Promise<Reservation[]>>();
const mockFetchReservationFeedback = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => mockUseRouter(),
}));

vi.mock('@/services/reservations', () => ({
  fetchAllReservationsForState: (opts: FetchAllReservationsOptions) =>
    mockFetchAllReservationsForState(opts),
  fetchReservationFeedback: (...args: unknown[]) =>
    mockFetchReservationFeedback(...args),
}));

import type { FetchAllReservationsOptions } from '@/services/reservations';
import type { Reservation } from '@/types/reservation';

import { useTargetReservationFeedback } from './useTargetReservationFeedback';

function makeHistoryItem(
  id: string,
  overrides: Partial<Reservation> = {}
): Reservation {
  return fromPartial<Reservation>({
    id,
    name: 'Emily Chen',
    roleLine: 'UI/UX Designer',
    date: '2026/10/20',
    time: '19:00–19:30',
    messages: [],
    scheduleId: 1,
    dtstart: 1760958000,
    dtend: 1760959800,
    senderUserId: '1',
    participantUserId: '201',
    version: 0,
    ...overrides,
  });
}

describe('useTargetReservationFeedback (#733)', () => {
  const stableRouter = { replace: mockReplace };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRouter.mockReturnValue(stableRouter);
    mockFetchReservationFeedback.mockResolvedValue(null);
    mockFetchAllReservationsForState.mockResolvedValue([]);
  });

  it('auto-opens feedback dialog when single feedback API returns nextStep === "ANSWER"', async () => {
    mockFetchReservationFeedback.mockResolvedValueOnce({
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
      viewerRole: 'mentee',
    });

    const history = [makeHistoryItem('101')];
    const { result } = renderHook(() =>
      useTargetReservationFeedback({
        userId: '1',
        userRole: 'mentee',
        reservationId: '101',
        history,
        isHistoryLoaded: true,
      })
    );

    await waitFor(() => {
      expect(result.current.autoOpenReservationId).toBe('101');
    });
    expect(result.current.targetReservationId).toBe('101');
    expect(result.current.historyWithTargetFeedback[0].feedback?.nextStep).toBe(
      'ANSWER'
    );
    expect(mockFetchReservationFeedback).toHaveBeenCalledTimes(1);
  });

  it('falls back to history list when single feedback API returns null (e.g. 404)', async () => {
    mockFetchReservationFeedback.mockResolvedValueOnce(null);

    const history = [
      makeHistoryItem('101', {
        feedback: {
          meetingHappened: null,
          rating: null,
          nextStep: 'ANSWER',
        },
      }),
    ];

    const { result } = renderHook(() =>
      useTargetReservationFeedback({
        userId: '1',
        userRole: 'mentee',
        reservationId: '101',
        history,
        isHistoryLoaded: true,
      })
    );

    await waitFor(() => {
      expect(result.current.autoOpenReservationId).toBe('101');
    });
  });

  it('falls back to history list when single feedback API rejects with a network error', async () => {
    const error = new Error('Network failure');
    mockFetchReservationFeedback.mockRejectedValueOnce(error);

    const history = [
      makeHistoryItem('101', {
        feedback: {
          meetingHappened: null,
          rating: null,
          nextStep: 'ANSWER',
        },
      }),
    ];

    const { result } = renderHook(() =>
      useTargetReservationFeedback({
        userId: '1',
        userRole: 'mentee',
        reservationId: '101',
        history,
        isHistoryLoaded: true,
      })
    );

    await waitFor(() => {
      expect(result.current.autoOpenReservationId).toBe('101');
    });
  });

  it('does not auto-open when single feedback API reports nextStep === null (already answered)', async () => {
    mockFetchReservationFeedback.mockResolvedValueOnce({
      feedback: {
        meetingHappened: true,
        rating: {
          rating: 10,
          content: '已填寫回饋',
          createdAt: 1760960000,
          updatedAt: 1760960000,
          authorName: '王＊明',
          isPublic: true,
        },
        nextStep: null,
      },
    });

    const staleHistory = [
      makeHistoryItem('101', {
        feedback: {
          meetingHappened: null,
          rating: null,
          nextStep: 'ANSWER',
        },
      }),
    ];

    const { result } = renderHook(() =>
      useTargetReservationFeedback({
        userId: '1',
        userRole: 'mentee',
        reservationId: '101',
        history: staleHistory,
        isHistoryLoaded: true,
      })
    );

    await waitFor(() => {
      expect(
        result.current.historyWithTargetFeedback[0].feedback?.nextStep
      ).toBeNull();
    });
    expect(result.current.autoOpenReservationId).toBeNull();
  });

  it('preserves subsequent history mutations after feedback submission instead of overwriting with initial singleFeedback', async () => {
    mockFetchReservationFeedback.mockResolvedValueOnce({
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
      viewerRole: 'mentee',
    });

    const initialHistory = [
      makeHistoryItem('101', {
        feedback: {
          meetingHappened: null,
          rating: null,
          nextStep: 'ANSWER',
        },
      }),
    ];

    const { result, rerender } = renderHook(
      ({ history }) =>
        useTargetReservationFeedback({
          userId: '1',
          userRole: 'mentee',
          reservationId: '101',
          history,
          isHistoryLoaded: true,
        }),
      { initialProps: { history: initialHistory } }
    );

    await waitFor(() => {
      expect(result.current.autoOpenReservationId).toBe('101');
    });

    const updatedHistory = [
      makeHistoryItem('101', {
        feedback: {
          meetingHappened: true,
          rating: {
            rating: 9,
            content: '收穫滿滿！',
            createdAt: 1760960100,
            updatedAt: 1760960100,
            authorName: '王＊明',
            isPublic: true,
          },
          nextStep: null,
        },
      }),
    ];

    rerender({ history: updatedHistory });

    const item = result.current.historyWithTargetFeedback[0];
    expect(result.current.autoOpenReservationId).toBeNull();
    expect(item.feedback?.nextStep).toBeNull();
    expect(item.feedback?.rating?.content).toBe('收穫滿滿！');
  });

  it('does not auto-open cancelled reservations even when nextStep === "ANSWER"', async () => {
    mockFetchReservationFeedback.mockResolvedValueOnce({
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
      viewerRole: 'mentee',
    });

    const cancelledHistory = [
      makeHistoryItem('101', {
        cancelledBy: 'MENTOR',
      }),
    ];

    const { result } = renderHook(() =>
      useTargetReservationFeedback({
        userId: '1',
        userRole: 'mentee',
        reservationId: '101',
        history: cancelledHistory,
        isHistoryLoaded: true,
      })
    );

    await waitFor(() => {
      const item = result.current.historyWithTargetFeedback[0];
      expect(item.feedback?.nextStep).toBe('ANSWER');
    });
    expect(result.current.autoOpenReservationId).toBeNull();
  });

  it('does not re-fetch or abort when useRouter returns a fresh object reference across renders', async () => {
    mockUseRouter.mockImplementation(() => ({ replace: mockReplace }));
    mockFetchReservationFeedback.mockResolvedValueOnce({
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
      viewerRole: 'mentee',
    });

    const history = [makeHistoryItem('101')];
    const { result, rerender } = renderHook(() =>
      useTargetReservationFeedback({
        userId: '1',
        userRole: 'mentee',
        reservationId: '101',
        history,
        isHistoryLoaded: true,
      })
    );

    await waitFor(() => {
      expect(result.current.autoOpenReservationId).toBe('101');
    });

    rerender();
    expect(mockFetchReservationFeedback).toHaveBeenCalledTimes(1);
    expect(result.current.autoOpenReservationId).toBe('101');
  });

  it('switches to /reservation/mentor?tab=history and keeps isResolvingRole true when viewerRole resolves to mentor', async () => {
    mockFetchReservationFeedback.mockResolvedValueOnce({
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
      viewerRole: 'mentor',
    });

    const { result } = renderHook(() =>
      useTargetReservationFeedback({
        userId: '1',
        userRole: 'mentee',
        isMentor: true,
        reservationId: '202',
        history: [],
        isHistoryLoaded: true,
      })
    );

    expect(result.current.isResolvingRole).toBe(true);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/reservation/mentor?tab=history&reservation_id=202',
        { scroll: false }
      );
    });
    expect(result.current.isResolvingRole).toBe(true);
  });

  it('probes all MENTOR_HISTORY pages via fetchAllReservationsForState once hasMoreHistory is false and switches to /reservation/mentor', async () => {
    mockFetchReservationFeedback.mockResolvedValueOnce(null);
    mockFetchAllReservationsForState.mockResolvedValueOnce([
      makeHistoryItem('201'),
      makeHistoryItem('202'),
    ]);

    const { result, rerender } = renderHook(
      ({ hasMoreHistory }) =>
        useTargetReservationFeedback({
          userId: '1',
          userRole: 'mentee',
          isMentor: true,
          reservationId: '202',
          history: [makeHistoryItem('101')],
          isHistoryLoaded: true,
          hasMoreHistory,
        }),
      { initialProps: { hasMoreHistory: true } }
    );

    expect(result.current.isResolvingRole).toBe(true);
    expect(mockFetchAllReservationsForState).not.toHaveBeenCalled();

    rerender({ hasMoreHistory: false });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/reservation/mentor?tab=history&reservation_id=202',
        { scroll: false }
      );
    });
    expect(mockFetchAllReservationsForState).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '1',
        state: 'MENTOR_HISTORY',
        signal: expect.any(AbortSignal),
        shouldStop: expect.any(Function),
      })
    );
    const probeOptions = mockFetchAllReservationsForState.mock.calls[0]?.[0];
    expect(probeOptions?.shouldStop?.([makeHistoryItem('201')])).toBe(false);
    expect(probeOptions?.shouldStop?.([makeHistoryItem('202')])).toBe(true);
    expect(result.current.isResolvingRole).toBe(true);
  });

  it('does not query MENTOR_HISTORY when target reservation arrives on a subsequent MENTEE_HISTORY page, and clears isResolvingRole', async () => {
    mockFetchReservationFeedback.mockResolvedValueOnce(null);

    const { result, rerender } = renderHook(
      ({ history, hasMoreHistory }) =>
        useTargetReservationFeedback({
          userId: '1',
          userRole: 'mentee',
          isMentor: true,
          reservationId: '105',
          history,
          isHistoryLoaded: true,
          hasMoreHistory,
        }),
      {
        initialProps: {
          history: [makeHistoryItem('101')],
          hasMoreHistory: true,
        },
      }
    );

    expect(result.current.isResolvingRole).toBe(true);

    rerender({
      history: [
        makeHistoryItem('101'),
        makeHistoryItem('105', {
          feedback: {
            meetingHappened: null,
            rating: null,
            nextStep: 'ANSWER',
          },
        }),
      ],
      hasMoreHistory: false,
    });

    await waitFor(() => {
      expect(result.current.isResolvingRole).toBe(false);
      expect(result.current.autoOpenReservationId).toBe('105');
    });
    expect(mockFetchAllReservationsForState).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('clears isResolvingRole when reservation is absent from both MENTEE_HISTORY and MENTOR_HISTORY', async () => {
    mockFetchReservationFeedback.mockResolvedValueOnce(null);
    mockFetchAllReservationsForState.mockResolvedValueOnce([]);

    const { result } = renderHook(() =>
      useTargetReservationFeedback({
        userId: '1',
        userRole: 'mentee',
        isMentor: true,
        reservationId: '999',
        history: [makeHistoryItem('101')],
        isHistoryLoaded: true,
        hasMoreHistory: false,
      })
    );

    expect(result.current.isResolvingRole).toBe(true);

    await waitFor(() => {
      expect(result.current.isResolvingRole).toBe(false);
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
