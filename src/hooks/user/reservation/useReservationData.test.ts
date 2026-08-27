import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { useReservationData } from './useReservationData';

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

beforeEach(() => {
  vi.clearAllMocks();
  reservationReadModel.clear();
  mockUseSession.mockReturnValue({
    data: mockSession,
    status: 'authenticated',
  });
  mockFetch.mockImplementation(({ state }) => stubFor(state));
});

describe('useReservationData (mentee)', () => {
  it('no session → fetchReservations is NOT called, isLoading becomes false', async () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });

    const { result } = await act(async () =>
      renderHook(() => useReservationData({ role: 'mentee' }))
    );

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it('initial mount fetches only mentee UPCOMING + PENDING (no history)', async () => {
    const { result } = await act(async () =>
      renderHook(() => useReservationData({ role: 'mentee' }))
    );

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
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.objectContaining({ state: 'MENTOR_UPCOMING' })
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isHistoryLoaded).toBe(false);
    expect(result.current.myUserId).toBe(mockSession.user.id);
    expect(result.current.data?.upcoming).toHaveLength(1);
    expect(result.current.data?.pending).toHaveLength(1);
    expect(result.current.data?.history).toEqual([]);
  });

  it('loadHistory fetches MENTEE_HISTORY exactly once across multiple calls', async () => {
    const { result } = renderHook(() => useReservationData({ role: 'mentee' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
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
    expect(result.current.isHistoryLoaded).toBe(true);
    expect(result.current.data?.history).toHaveLength(1);
  });

  it('resets historyActive on fetch failure, allowing subsequent loadHistory retries', async () => {
    const { result } = renderHook(() => useReservationData({ role: 'mentee' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockFetch.mockClear();

    // Mock fetch failure for history
    mockFetch.mockRejectedValueOnce(new Error('Fetch failed'));

    await act(async () => {
      await result.current.loadHistory();
    });

    // Wait for failure
    await waitFor(() => {
      expect(result.current.isLoadingHistory).toBe(false);
      expect(result.current.isHistoryLoaded).toBe(false);
      expect(result.current.initialState.history).toBe('idle'); // Should revert to idle!
    });

    // Now Mock fetch success for history retry
    const mockRetriedReservations = {
      items: [makeReservation('MENTEE_HISTORY')],
      next_dtend: 0,
    };
    mockFetch.mockResolvedValueOnce(mockRetriedReservations);

    // Call loadHistory again to retry
    await act(async () => {
      await result.current.loadHistory();
    });

    await waitFor(() => {
      expect(result.current.isHistoryLoaded).toBe(true);
      expect(result.current.initialState.history).toBe('ready');
      expect(result.current.data?.history).toHaveLength(1);
    });
  });

  it('onMutationSuccess never calls fetchReservations - cache freshness is now owned by the write path (X-Tracker #651)', async () => {
    const { result } = renderHook(() => useReservationData({ role: 'mentee' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockFetch.mockClear();

    await act(async () => {
      result.current.onMutationSuccess('any-id', ['pending', 'history']);
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('onMutationSuccess filters out (removes) the operated item from active lists in local state', async () => {
    const { result } = renderHook(() => useReservationData({ role: 'mentee' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Initially, there's a reservation in pending
    expect(result.current.data?.pending).toHaveLength(1);
    expect(result.current.data?.pending[0].id).toBe('MENTEE_PENDING');

    await act(async () => {
      result.current.onMutationSuccess('MENTEE_PENDING', ['pending']);
    });

    expect(result.current.data?.pending).toHaveLength(0);
  });

  it('onMutationSuccess only hides the item from the source (first) tab, never a destination tab it has not actually appeared in yet', async () => {
    const { result } = renderHook(() => useReservationData({ role: 'mentee' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Accept-shaped call: 'pending' is the source (item currently lives
    // there), 'upcoming' is the destination it's moving to.
    await act(async () => {
      result.current.onMutationSuccess('MENTEE_PENDING', [
        'pending',
        'upcoming',
      ]);
    });

    expect(result.current.data?.pending).toHaveLength(0);

    // The write path (not this hook) is what makes the item show up in the
    // destination tab's cache - simulate that here. It must render, not be
    // hidden by a stray removedIds entry from the call above.
    await act(async () => {
      reservationReadModel.set(
        { userId: String(mockSession.user.id), state: 'MENTEE_UPCOMING' },
        { items: [makeReservation('MENTEE_PENDING')], next_dtend: 0 }
      );
    });

    expect(result.current.data?.upcoming.map((it) => it.id)).toEqual([
      'MENTEE_PENDING',
    ]);
  });

  it('refetchOnConflict refetches the affected states without removing the item first', async () => {
    const { result } = renderHook(() => useReservationData({ role: 'mentee' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Initially, there's a reservation in pending
    expect(result.current.data?.pending).toHaveLength(1);

    // Refetch resolves with the same item (still present, just refreshed —
    // unlike onMutationSuccess, refetchOnConflict never assumes it moved out).
    mockFetch.mockClear();

    await act(async () => {
      result.current.refetchOnConflict(['pending']);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockSession.user.id,
        state: 'MENTEE_PENDING',
      })
    );
    expect(result.current.data?.pending).toHaveLength(1);
  });

  it('refetchOnConflict refetches history too when it has been loaded', async () => {
    const { result } = renderHook(() => useReservationData({ role: 'mentee' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.loadHistory();
    });
    mockFetch.mockClear();

    await act(async () => {
      result.current.refetchOnConflict(['pending', 'history']);
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockSession.user.id,
        state: 'MENTEE_PENDING',
      })
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockSession.user.id,
        state: 'MENTEE_HISTORY',
      })
    );
  });

  it('initial fetch failure → data stays null, isLoading becomes false', async () => {
    mockFetch.mockReset();
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = await act(async () =>
      renderHook(() => useReservationData({ role: 'mentee' }))
    );

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('loadingMoreStates is per-state — loading one state does not block another', async () => {
    // Initial mount with non-zero cursors so loadMore is allowed to run
    mockFetch.mockReset();
    mockFetch.mockImplementation(({ state }) =>
      Promise.resolve({
        items: [makeReservation(state)],
        next_dtend: 1700000000,
      })
    );

    const { result } = renderHook(() => useReservationData({ role: 'mentee' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Stage controllable responses for the two concurrent load-mores
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
      void result.current.loadMore('upcoming');
    });
    expect(result.current.loadingMoreStates.upcoming).toBe(true);
    expect(result.current.loadingMoreStates.pending).toBe(false);

    await act(async () => {
      void result.current.loadMore('pending');
    });
    expect(result.current.loadingMoreStates.upcoming).toBe(true);
    expect(result.current.loadingMoreStates.pending).toBe(true);

    await act(async () => {
      resolveUpcoming({
        items: [makeReservation('upcoming-extra')],
        next_dtend: 0,
      });
    });
    expect(result.current.loadingMoreStates.upcoming).toBe(false);
    expect(result.current.loadingMoreStates.pending).toBe(true);

    await act(async () => {
      resolvePending({
        items: [makeReservation('pending-extra')],
        next_dtend: 0,
      });
    });
    expect(result.current.loadingMoreStates.pending).toBe(false);
  });

  it('component unmounts before fetch resolves → state is NOT updated', async () => {
    let resolveFetch!: () => void;
    mockFetch.mockReset();
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = () =>
            resolve({ items: [makeReservation('1')], next_dtend: 0 });
        })
    );

    const { result, unmount } = renderHook(() =>
      useReservationData({ role: 'mentee' })
    );

    unmount();

    await act(async () => {
      resolveFetch();
    });

    expect(result.current.data).toBeNull();
  });

  it('does not capture flow failure when fetchReservations throws AbortError (request cancellation)', async () => {
    const abortError = new Error('The operation was aborted.');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValue(abortError);

    renderHook(() => useReservationData({ role: 'mentee' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(mockCaptureFlowFailure).not.toHaveBeenCalled();
  });

  it('captures flow failure when fetchReservations throws a regular Error', async () => {
    const regularError = new Error('Network failure');
    mockFetch.mockRejectedValue(regularError);

    renderHook(() => useReservationData({ role: 'mentee' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: 'reservation_initial_fetch',
        message: 'Network failure',
      })
    );
  });

  it('loadMore uses the updated next_dtend token from the cache, avoiding stale closure bugs', async () => {
    mockFetch.mockReset();
    // First fetch for upcoming returns next_dtend: 12345
    mockFetch.mockImplementation(({ state }) => {
      if (state === 'MENTEE_UPCOMING') {
        return Promise.resolve({
          items: [makeReservation('upcoming-1')],
          next_dtend: 12345,
        });
      }
      return Promise.resolve({ items: [], next_dtend: 0 });
    });

    const { result } = renderHook(() => useReservationData({ role: 'mentee' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Mock next fetch to return next_dtend: 67890
    mockFetch.mockResolvedValueOnce({
      items: [makeReservation('upcoming-2')],
      next_dtend: 67890,
    });

    await act(async () => {
      await result.current.loadMore('upcoming');
    });

    // Verify first loadMore called with cursor 12345
    expect(mockFetch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userId: mockSession.user.id,
        state: 'MENTEE_UPCOMING',
        nextDtend: 12345,
      })
    );

    // Mock next fetch for second loadMore
    mockFetch.mockResolvedValueOnce({
      items: [makeReservation('upcoming-3')],
      next_dtend: 0,
    });

    await act(async () => {
      await result.current.loadMore('upcoming');
    });

    // Verify second loadMore called with the updated cursor 67890 (no stale closure!)
    expect(mockFetch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userId: mockSession.user.id,
        state: 'MENTEE_UPCOMING',
        nextDtend: 67890,
      })
    );
  });
});

describe('useReservationData (mentor)', () => {
  it('initial mount fetches only mentor UPCOMING + PENDING (no history)', async () => {
    const { result } = await act(async () =>
      renderHook(() => useReservationData({ role: 'mentor' }))
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockSession.user.id,
        state: 'MENTOR_UPCOMING',
      })
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockSession.user.id,
        state: 'MENTOR_PENDING',
      })
    );
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.objectContaining({ state: 'MENTOR_HISTORY' })
    );
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.objectContaining({ state: 'MENTEE_UPCOMING' })
    );

    expect(result.current.isLoading).toBe(false);
  });

  it('accept-flow onMutationSuccess only hides the source tab locally - no refetch (X-Tracker #651)', async () => {
    const { result } = renderHook(() => useReservationData({ role: 'mentor' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockFetch.mockClear();

    await act(async () => {
      result.current.onMutationSuccess('MENTOR_PENDING', [
        'pending',
        'upcoming',
      ]);
    });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.data?.pending).toHaveLength(0);
  });

  it('refetchOnConflict never sends batch param so backend uses default page size', async () => {
    const { result } = renderHook(() => useReservationData({ role: 'mentor' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockFetch.mockClear();

    await act(async () => {
      result.current.refetchOnConflict(['pending']);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockSession.user.id,
        state: 'MENTOR_PENDING',
      })
    );
    const lastCall = mockFetch.mock.calls.at(-1)?.[0];
    expect(lastCall).not.toHaveProperty('batch');
  });
});
