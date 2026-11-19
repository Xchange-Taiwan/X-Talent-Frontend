import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSearchParam = vi.fn<(key: string) => string | null>(() => null);

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => mockGetSearchParam(key),
    toString: () => '',
  }),
}));

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

vi.mock('@/services/reservations', async () => {
  const actual = await vi.importActual<
    typeof import('@/services/reservations')
  >('@/services/reservations');
  return {
    ...actual,
    fetchReservations: vi.fn(),
  };
});

vi.mock('@/lib/monitoring', () => ({ captureFlowFailure: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));

import { captureFlowFailure } from '@/lib/monitoring';
import { reservationReadModel } from '@/lib/reservation/reservationReadModel';
import {
  fetchReservations,
  type ReservationState,
} from '@/services/reservations';
import { mockSession, mockUseSession } from '@/test/mocks/nextAuth';

import { useReservationDashboard } from './useReservationData';

const mockFetch = vi.mocked(fetchReservations);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);

const makeReservation = (id: string) => ({
  id,
  name: 'Test User',
  roleLine: 'Engineer',
  date: 'Mon, Jan 01, 2024',
  time: '10:00 am – 11:00 am',
  messages: [],
  scheduleId: 1,
  dtstart: 1700000000,
  dtend: 1700003600,
  senderUserId: 'sender-1',
  participantUserId: 'participant-1',
  version: 0,
});

const stubFor = (state: ReservationState) =>
  Promise.resolve({
    items: [makeReservation(state)],
    next_dtend: 0,
  });

const setQueryParams = (params: Record<string, string | undefined>) => {
  mockGetSearchParam.mockImplementation((key: string) => params[key] ?? null);
};

beforeEach(() => {
  vi.clearAllMocks();
  reservationReadModel.clear();
  mockGetSearchParam.mockReturnValue(null);
  mockUseSession.mockReturnValue({
    data: mockSession,
    status: 'authenticated',
  });
  mockFetch.mockImplementation(({ state }) => stubFor(state));
});

describe('useReservationDashboard (mentee)', () => {
  it('no session -> fetchReservations is NOT called, all tab initial loading flags are false', async () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });

    const { result } = await act(async () =>
      renderHook(() => useReservationDashboard({ role: 'mentee' }))
    );

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.activeTab).toBe('pending');
    expect(result.current.tabs.pending.isInitialLoading).toBe(false);
    expect(result.current.tabs.upcoming.isInitialLoading).toBe(false);
    expect(result.current.tabs.history.isInitialLoading).toBe(false);
    expect(result.current.tabs.pending.items).toEqual([]);
  });

  it('default mount (no ?tab=) resolves activeTab="pending" and fetches only UPCOMING + PENDING', async () => {
    const { result } = await act(async () =>
      renderHook(() => useReservationDashboard({ role: 'mentee' }))
    );

    expect(result.current.activeTab).toBe('pending');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockSession.user.id,
        state: 'MENTEE_UPCOMING',
      })
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockSession.user.id,
        state: 'MENTEE_PENDING',
      })
    );
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.objectContaining({ state: 'MENTEE_HISTORY' })
    );

    expect(result.current.tabs.pending.isInitialLoading).toBe(false);
    expect(result.current.tabs.upcoming.isInitialLoading).toBe(false);
    expect(result.current.tabs.history.isLoaded).toBe(false);
    expect(result.current.tabs.history.showBadge).toBe(false);
    expect(result.current.myUserId).toBe(mockSession.user.id);
    expect(result.current.tabs.upcoming.items).toHaveLength(1);
    expect(result.current.tabs.pending.items).toHaveLength(1);
    expect(result.current.tabs.history.items).toEqual([]);
  });

  it('subscribes historyKey on Render 1 when entering with ?tab=history (eliminates Render-1 empty-state flash, #939)', async () => {
    setQueryParams({ tab: 'history' });
    let resolveHistory!: (v: {
      items: ReturnType<typeof makeReservation>[];
      next_dtend: number;
    }) => void;
    mockFetch.mockImplementation(({ state }) => {
      if (state === 'MENTEE_HISTORY') {
        return new Promise((resolve) => {
          resolveHistory = resolve;
        });
      }
      return stubFor(state);
    });

    const { result } = renderHook(() =>
      useReservationDashboard({ role: 'mentee' })
    );

    // Render 1 synchronous check: activeTab is 'history' and isInitialLoading is IMMEDIATELY true
    expect(result.current.activeTab).toBe('history');
    expect(result.current.tabs.history.isInitialLoading).toBe(true);
    expect(result.current.tabs.history.isLoaded).toBe(false);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockSession.user.id,
          state: 'MENTEE_HISTORY',
        })
      );
    });

    await act(async () => {
      resolveHistory({
        items: [makeReservation('hist-1')],
        next_dtend: 0,
      });
    });

    expect(result.current.tabs.history.isInitialLoading).toBe(false);
    expect(result.current.tabs.history.isLoaded).toBe(true);
    expect(result.current.tabs.history.showBadge).toBe(true);
    expect(result.current.tabs.history.badgeCount).toBe(1);
    expect(result.current.tabs.history.items).toHaveLength(1);
  });

  it.each([
    { reservationId: '101' },
    { reservation_id: '101' },
    { feedbackReservationId: '101' },
    { feedback: 'queue' },
  ])(
    'forces activeTab="history" and enables historyKey on Render 1 when deep-link/queue params %j are present (#939)',
    async (params) => {
      setQueryParams(params);
      const { result } = renderHook(() =>
        useReservationDashboard({ role: 'mentee' })
      );

      expect(result.current.activeTab).toBe('history');
      expect(result.current.tabs.history.isInitialLoading).toBe(true);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: mockSession.user.id,
            state: 'MENTEE_HISTORY',
          })
        );
      });
    }
  );

  it.each([{ reservationId: '101' }, { feedback: 'queue' }])(
    'keeps activeTab="pending" and does NOT subscribe historyKey when NEXT_PUBLIC_ENABLE_FEEDBACK=false for %j (#913 / #939)',
    async (params) => {
      vi.stubEnv('NEXT_PUBLIC_ENABLE_FEEDBACK', 'false');
      try {
        setQueryParams(params);
        const { result } = await act(async () =>
          renderHook(() => useReservationDashboard({ role: 'mentee' }))
        );

        expect(result.current.activeTab).toBe('pending');
        expect(result.current.tabs.history.isInitialLoading).toBe(false);
        expect(mockFetch).not.toHaveBeenCalledWith(
          expect.objectContaining({ state: 'MENTEE_HISTORY' })
        );
      } finally {
        vi.unstubAllEnvs();
      }
    }
  );

  it('loadHistory fetches MENTEE_HISTORY exactly once across multiple calls', async () => {
    const { result } = renderHook(() =>
      useReservationDashboard({ role: 'mentee' })
    );
    await waitFor(() =>
      expect(result.current.tabs.pending.isInitialLoading).toBe(false)
    );
    mockFetch.mockClear();

    await act(async () => {
      await result.current.loadHistory();
    });
    await act(async () => {
      await result.current.loadHistory();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockSession.user.id,
        state: 'MENTEE_HISTORY',
      })
    );
    expect(result.current.tabs.history.isLoaded).toBe(true);
    expect(result.current.tabs.history.items).toHaveLength(1);
  });

  it('allows subsequent loadHistory retries after fetch failure (including when already on ?tab=history)', async () => {
    setQueryParams({ tab: 'history' });
    mockFetch.mockImplementation(({ state }) => {
      if (state === 'MENTEE_HISTORY') {
        return Promise.reject(new Error('Fetch failed'));
      }
      return stubFor(state);
    });

    const { result } = renderHook(() =>
      useReservationDashboard({ role: 'mentee' })
    );

    await waitFor(() => {
      expect(result.current.tabs.history.isFetching).toBe(false);
      expect(result.current.tabs.history.isInitialLoading).toBe(false);
      expect(result.current.tabs.history.isLoaded).toBe(false);
    });

    mockFetch.mockResolvedValueOnce({
      items: [makeReservation('MENTEE_HISTORY')],
      next_dtend: 0,
    });

    await act(async () => {
      await result.current.loadHistory();
    });

    await waitFor(() => {
      expect(result.current.tabs.history.isLoaded).toBe(true);
      expect(result.current.tabs.history.items).toHaveLength(1);
    });
  });

  it('retains settled badge counts across transient loading states and resets when role changes (#860 / #939)', async () => {
    const { result, rerender } = renderHook(
      ({ role }: { role: 'mentee' | 'mentor' }) =>
        useReservationDashboard({ role }),
      { initialProps: { role: 'mentee' as 'mentee' | 'mentor' } }
    );

    await waitFor(() =>
      expect(result.current.tabs.pending.isInitialLoading).toBe(false)
    );
    expect(result.current.tabs.pending.badgeCount).toBe(1);
    expect(result.current.tabs.upcoming.badgeCount).toBe(1);

    let resolveHistory!: (v: {
      items: ReturnType<typeof makeReservation>[];
      next_dtend: number;
    }) => void;
    mockFetch.mockImplementation(({ state }) => {
      if (state === 'MENTEE_HISTORY') {
        return new Promise((resolve) => {
          resolveHistory = resolve;
        });
      }
      return Promise.resolve({ items: [], next_dtend: 0 });
    });

    await act(async () => {
      reservationReadModel.invalidate({
        userId: String(mockSession.user.id),
        state: 'MENTEE_PENDING',
      });
      void result.current.loadHistory();
    });

    expect(result.current.tabs.history.isFetching).toBe(true);
    expect(result.current.tabs.pending.badgeCount).toBe(1);

    await act(async () => {
      resolveHistory({ items: [makeReservation('h1')], next_dtend: 0 });
    });

    expect(result.current.tabs.history.showBadge).toBe(true);
    expect(result.current.tabs.history.badgeCount).toBe(1);

    await act(async () => {
      rerender({ role: 'mentor' });
    });
    expect(result.current.tabs.history.showBadge).toBe(false);
  });

  it('resets retained badge counts and history visibility when signed-in user account changes with same role (#939)', async () => {
    setQueryParams({ tab: 'history' });
    const { result, rerender } = renderHook(() =>
      useReservationDashboard({ role: 'mentee' })
    );

    await waitFor(() =>
      expect(result.current.tabs.history.isLoaded).toBe(true)
    );
    expect(result.current.tabs.history.showBadge).toBe(true);
    expect(result.current.tabs.history.badgeCount).toBe(1);

    // Switch to another user account on pending tab before history is fetched for the new user
    setQueryParams({});
    mockUseSession.mockReturnValue({
      data: {
        ...mockSession,
        user: { ...mockSession.user, id: 'user-other-999' },
      },
      status: 'authenticated',
    });

    await act(async () => {
      rerender();
    });

    expect(result.current.myUserId).toBe('user-other-999');
    expect(result.current.tabs.history.showBadge).toBe(false);
    expect(result.current.tabs.history.badgeCount).toBe(0);
  });

  it('reservationReadModel.evictItem removes operated item and updates destination slice (#783)', async () => {
    const { result } = renderHook(() =>
      useReservationDashboard({ role: 'mentee' })
    );
    await waitFor(() =>
      expect(result.current.tabs.pending.isInitialLoading).toBe(false)
    );
    mockFetch.mockClear();

    expect(result.current.tabs.pending.items).toHaveLength(1);

    await act(async () => {
      reservationReadModel.evictItem(
        { userId: String(mockSession.user.id), state: 'MENTEE_PENDING' },
        'MENTEE_PENDING'
      );
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.tabs.pending.items).toHaveLength(0);

    await act(async () => {
      reservationReadModel.set(
        { userId: String(mockSession.user.id), state: 'MENTEE_UPCOMING' },
        { items: [makeReservation('MENTEE_PENDING')], next_dtend: 0 }
      );
    });

    expect(result.current.tabs.upcoming.items.map((it) => it.id)).toEqual([
      'MENTEE_PENDING',
    ]);
  });

  it('isLoadingMore is tracked per tab without blocking sibling tabs', async () => {
    mockFetch.mockReset();
    mockFetch.mockImplementation(({ state }) =>
      Promise.resolve({
        items: [makeReservation(state)],
        next_dtend: 1700000000,
      })
    );

    const { result } = renderHook(() =>
      useReservationDashboard({ role: 'mentee' })
    );
    await waitFor(() =>
      expect(result.current.tabs.pending.isInitialLoading).toBe(false)
    );

    let resolveUpcoming!: (v: {
      items: ReturnType<typeof makeReservation>[];
      next_dtend: number;
    }) => void;
    let resolvePending!: (v: {
      items: ReturnType<typeof makeReservation>[];
      next_dtend: number;
    }) => void;
    mockFetch.mockImplementation(({ state }) => {
      if (state === 'MENTEE_UPCOMING') {
        return new Promise((resolve) => {
          resolveUpcoming = resolve;
        });
      }
      if (state === 'MENTEE_PENDING') {
        return new Promise((resolve) => {
          resolvePending = resolve;
        });
      }
      return Promise.resolve({ items: [], next_dtend: 0 });
    });

    await act(async () => {
      void result.current.tabs.upcoming.loadMore();
    });
    expect(result.current.tabs.upcoming.isLoadingMore).toBe(true);
    expect(result.current.tabs.pending.isLoadingMore).toBe(false);

    await act(async () => {
      void result.current.tabs.pending.loadMore();
    });
    expect(result.current.tabs.upcoming.isLoadingMore).toBe(true);
    expect(result.current.tabs.pending.isLoadingMore).toBe(true);

    await act(async () => {
      resolveUpcoming({
        items: [makeReservation('upcoming-extra')],
        next_dtend: 0,
      });
    });
    expect(result.current.tabs.upcoming.isLoadingMore).toBe(false);
    expect(result.current.tabs.pending.isLoadingMore).toBe(true);

    await act(async () => {
      resolvePending({
        items: [makeReservation('pending-extra')],
        next_dtend: 0,
      });
    });
    expect(result.current.tabs.pending.isLoadingMore).toBe(false);
  });

  it('does not capture flow failure on AbortError and captures flow failure on regular Error', async () => {
    const abortError = new Error('The operation was aborted.');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValue(abortError);

    const { unmount } = renderHook(() =>
      useReservationDashboard({ role: 'mentee' })
    );
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(mockCaptureFlowFailure).not.toHaveBeenCalled();
    unmount();

    mockFetch.mockRejectedValue(new Error('Network failure'));
    renderHook(() => useReservationDashboard({ role: 'mentee' }));
    await waitFor(() =>
      expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          flow: 'reservation_initial_fetch',
          message: 'Network failure',
        })
      )
    );
  });

  it('delegates cursor pagination and next_dtend === 0 guard directly to reservationReadModel.loadNextPage (#939)', async () => {
    const loadNextPageSpy = vi.spyOn(reservationReadModel, 'loadNextPage');
    mockFetch.mockReset();
    mockFetch.mockImplementation(({ state }) => {
      if (state === 'MENTEE_UPCOMING') {
        return Promise.resolve({
          items: [makeReservation('upcoming-1')],
          next_dtend: 12345,
        });
      }
      return Promise.resolve({ items: [], next_dtend: 0 });
    });

    const { result } = renderHook(() =>
      useReservationDashboard({ role: 'mentee' })
    );
    await waitFor(() =>
      expect(result.current.tabs.upcoming.isInitialLoading).toBe(false)
    );
    expect(result.current.tabs.upcoming.hasMore).toBe(true);
    expect(result.current.tabs.pending.hasMore).toBe(false);

    mockFetch.mockResolvedValueOnce({
      items: [makeReservation('upcoming-2')],
      next_dtend: 0,
    });

    await act(async () => {
      await result.current.tabs.upcoming.loadMore();
    });

    expect(mockFetch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userId: mockSession.user.id,
        state: 'MENTEE_UPCOMING',
        nextDtend: 12345,
      })
    );
    expect(result.current.tabs.upcoming.hasMore).toBe(false);

    mockFetch.mockClear();
    loadNextPageSpy.mockClear();
    await act(async () => {
      await result.current.tabs.upcoming.loadMore();
    });
    expect(loadNextPageSpy).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();
    loadNextPageSpy.mockRestore();
  });
});

describe('useReservationDashboard (mentor)', () => {
  it('derives cancelled pending and upcoming reservations into history slice (#881)', async () => {
    mockFetch.mockImplementation(({ state }) => {
      if (state === 'MENTOR_PENDING') {
        return Promise.resolve({
          items: [
            {
              ...makeReservation('stale-pending'),
              cancelledBy: 'SYSTEM' as const,
            },
            makeReservation('active-pending'),
          ],
          next_dtend: 0,
        });
      }
      if (state === 'MENTOR_UPCOMING') {
        return Promise.resolve({
          items: [
            {
              ...makeReservation('upcoming-later'),
              dtstart: 1700007200,
            },
            {
              ...makeReservation('stale-upcoming-cancelled'),
              dtstart: 1700001800,
              cancelledBy: 'MENTEE' as const,
            },
            {
              ...makeReservation('upcoming-sooner'),
              dtstart: 1700003600,
            },
          ],
          next_dtend: 0,
        });
      }
      return Promise.resolve({ items: [], next_dtend: 0 });
    });

    const { result } = renderHook(() =>
      useReservationDashboard({ role: 'mentor' })
    );
    await waitFor(() =>
      expect(result.current.tabs.pending.isInitialLoading).toBe(false)
    );

    expect(result.current.tabs.pending.items.map((it) => it.id)).toEqual([
      'active-pending',
    ]);
    expect(result.current.tabs.upcoming.items.map((it) => it.id)).toEqual([
      'upcoming-sooner',
      'upcoming-later',
    ]);
    expect(result.current.tabs.history.items.map((it) => it.id)).toEqual([
      'stale-upcoming-cancelled',
      'stale-pending',
    ]);
  });

  it('aborts in-flight loadMore via reservationReadModel.loadNextPage when clear() runs on account switch (#899)', async () => {
    let capturedSignal: AbortSignal | undefined;
    mockFetch.mockImplementation(({ state, nextDtend, signal }) => {
      if (state === 'MENTEE_UPCOMING' && nextDtend === 777) {
        capturedSignal = signal;
        return new Promise(() => {});
      }
      return Promise.resolve({
        items: [makeReservation('initial-upcoming')],
        next_dtend: state === 'MENTEE_UPCOMING' ? 777 : 0,
      });
    });

    const { result } = renderHook(() =>
      useReservationDashboard({ role: 'mentee' })
    );
    await waitFor(() =>
      expect(result.current.tabs.upcoming.isInitialLoading).toBe(false)
    );

    let loadMoreDone = false;
    act(() => {
      void result.current.tabs.upcoming.loadMore().then(() => {
        loadMoreDone = true;
      });
    });

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    await act(async () => {
      reservationReadModel.clear();
      await Promise.resolve();
    });

    expect(capturedSignal?.aborted).toBe(true);
    expect(loadMoreDone).toBe(true);
  });
});
