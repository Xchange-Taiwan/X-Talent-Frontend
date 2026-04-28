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

import {
  fetchReservations,
  type ReservationState,
} from '@/services/reservations';
import { mockSession, mockUseSession } from '@/test/mocks/nextAuth';

import { useReservationData } from './useReservationData';

const mockFetch = vi.mocked(fetchReservations);

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
});

const stubFor = (state: ReservationState) =>
  Promise.resolve({
    items: [makeReservation(state)],
    next_dtend: 0,
  });

beforeEach(() => {
  vi.clearAllMocks();
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
    expect(mockFetch).toHaveBeenCalledWith({
      userId: mockSession.user.id,
      state: 'MENTEE_UPCOMING',
    });
    expect(mockFetch).toHaveBeenCalledWith({
      userId: mockSession.user.id,
      state: 'MENTEE_PENDING',
    });
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
    expect(mockFetch).toHaveBeenCalledWith({
      userId: mockSession.user.id,
      state: 'MENTEE_HISTORY',
    });
    expect(result.current.isHistoryLoaded).toBe(true);
    expect(result.current.data?.history).toHaveLength(1);
  });

  it('onMutationSuccess refetches only the affected states (history skipped when not loaded)', async () => {
    const { result } = renderHook(() => useReservationData({ role: 'mentee' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockFetch.mockClear();

    await act(async () => {
      result.current.onMutationSuccess('any-id', [
        'MENTEE_PENDING',
        'MENTEE_HISTORY',
      ]);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith({
      userId: mockSession.user.id,
      state: 'MENTEE_PENDING',
    });
  });

  it('onMutationSuccess refetches history when it has been loaded', async () => {
    const { result } = renderHook(() => useReservationData({ role: 'mentee' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.loadHistory();
    });
    mockFetch.mockClear();

    await act(async () => {
      result.current.onMutationSuccess('any-id', [
        'MENTEE_PENDING',
        'MENTEE_HISTORY',
      ]);
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith({
      userId: mockSession.user.id,
      state: 'MENTEE_PENDING',
    });
    expect(mockFetch).toHaveBeenCalledWith({
      userId: mockSession.user.id,
      state: 'MENTEE_HISTORY',
    });
  });

  it('onMutationSuccess ignores affectedStates that belong to the other role', async () => {
    const { result } = renderHook(() => useReservationData({ role: 'mentee' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockFetch.mockClear();

    await act(async () => {
      result.current.onMutationSuccess('any-id', [
        'MENTOR_PENDING',
        'MENTOR_UPCOMING',
      ]);
    });

    expect(mockFetch).not.toHaveBeenCalled();
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
});

describe('useReservationData (mentor)', () => {
  it('initial mount fetches only mentor UPCOMING + PENDING (no history)', async () => {
    const { result } = await act(async () =>
      renderHook(() => useReservationData({ role: 'mentor' }))
    );

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith({
      userId: mockSession.user.id,
      state: 'MENTOR_UPCOMING',
    });
    expect(mockFetch).toHaveBeenCalledWith({
      userId: mockSession.user.id,
      state: 'MENTOR_PENDING',
    });
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.objectContaining({ state: 'MENTOR_HISTORY' })
    );
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.objectContaining({ state: 'MENTEE_UPCOMING' })
    );

    expect(result.current.isLoading).toBe(false);
  });

  it('accept-flow refetch only triggers MENTOR_PENDING + MENTOR_UPCOMING', async () => {
    const { result } = renderHook(() => useReservationData({ role: 'mentor' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockFetch.mockClear();

    await act(async () => {
      result.current.onMutationSuccess('any-id', [
        'MENTOR_PENDING',
        'MENTOR_UPCOMING',
      ]);
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith({
      userId: mockSession.user.id,
      state: 'MENTOR_PENDING',
    });
    expect(mockFetch).toHaveBeenCalledWith({
      userId: mockSession.user.id,
      state: 'MENTOR_UPCOMING',
    });
  });

  it('refetch never sends batch param so backend uses default page size', async () => {
    const { result } = renderHook(() => useReservationData({ role: 'mentor' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mockFetch.mockClear();

    await act(async () => {
      result.current.onMutationSuccess('any-id', ['MENTOR_PENDING']);
    });

    expect(mockFetch).toHaveBeenCalledWith({
      userId: mockSession.user.id,
      state: 'MENTOR_PENDING',
    });
    const lastCall = mockFetch.mock.calls.at(-1)?.[0];
    expect(lastCall).not.toHaveProperty('batch');
  });
});
