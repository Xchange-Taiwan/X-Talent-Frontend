import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

vi.mock('@/services/reservations', () => ({
  fetchAllReservationLists: vi.fn(),
}));

vi.mock('@/lib/monitoring', () => ({ captureFlowFailure: vi.fn() }));

import { fetchAllReservationLists } from '@/services/reservations';
import { mockSession, mockUseSession } from '@/test/mocks/nextAuth';

import { useReservationData } from './useReservationData';

const mockFetch = vi.mocked(fetchAllReservationLists);

const makeReservation = (id: string) => ({
  id,
  name: 'Test User',
  roleLine: 'Engineer',
  date: 'Mon, Jan 01, 2024',
  time: '10:00 am – 11:00 am',
  scheduleId: 1,
  dtstart: 1700000000,
  dtend: 1700003600,
  senderUserId: 'sender-1',
  participantUserId: 'participant-1',
});

const mockLists = {
  upcomingMentee: [makeReservation('1')],
  pendingMentee: [makeReservation('2')],
  upcomingMentor: [makeReservation('3')],
  pendingMentor: [makeReservation('4')],
  history: [makeReservation('5')],
  nextTokens: {
    menteeUpcoming: 0,
    menteePending: 0,
    mentorUpcoming: 0,
    mentorPending: 0,
    history: 0,
  },
};

describe('useReservationData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
    });
    mockFetch.mockResolvedValue(mockLists);
  });

  it('no session → fetchAllReservationLists is NOT called, isLoading becomes false', async () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });

    const { result } = await act(async () =>
      renderHook(() => useReservationData())
    );

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it('has session + fetch succeeds → data contains all five reservation lists correctly mapped', async () => {
    const { result } = await act(async () =>
      renderHook(() => useReservationData())
    );

    expect(mockFetch).toHaveBeenCalledWith({ userId: mockSession.user.id });
    expect(result.current.data).toEqual({
      upcomingMentee: mockLists.upcomingMentee,
      pendingMentee: mockLists.pendingMentee,
      upcomingMentor: mockLists.upcomingMentor,
      pendingMentor: mockLists.pendingMentor,
      history: mockLists.history,
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('has session + fetch throws → data remains null, isLoading becomes false', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = await act(async () =>
      renderHook(() => useReservationData())
    );

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('component unmounts before fetch resolves → state is NOT updated', async () => {
    let resolveFetch!: (value: typeof mockLists) => void;
    mockFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const { result, unmount } = renderHook(() => useReservationData());

    unmount();

    await act(async () => {
      resolveFetch(mockLists);
    });

    expect(result.current.data).toBeNull();
  });
});
