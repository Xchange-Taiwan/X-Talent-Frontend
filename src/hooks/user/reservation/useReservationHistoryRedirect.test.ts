import { renderHook, waitFor } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createFeedbackSessionCoordinator,
  createInMemoryFeedbackSessionStoragePort,
} from '@/lib/reservation/feedbackSessionCoordinator';
import type { Reservation } from '@/types/reservation';

import { useReservationHistoryRedirect } from './useReservationHistoryRedirect';

const mockReplace = vi.fn();
const mockUseSession = vi.fn();
const mockFetchSingle = vi.fn();
let currentQuery = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: (url: string, opts?: { scroll?: boolean }) =>
      mockReplace(url, opts),
  }),
  useSearchParams: () => new URLSearchParams(currentQuery),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

vi.mock('@/services/reservations', () => ({
  fetchSingleReservationFeedback: (...args: unknown[]) =>
    mockFetchSingle(...args),
}));

describe('useReservationHistoryRedirect (#906)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentQuery = '';
  });

  it('redirects unauthenticated visitors to /auth/signin preserving callbackUrl', async () => {
    currentQuery = 'reservation_id=301';
    mockUseSession.mockReturnValue({ status: 'unauthenticated', data: null });

    const coordinator = createFeedbackSessionCoordinator({
      storage: createInMemoryFeedbackSessionStoragePort(),
    });
    renderHook(() => useReservationHistoryRedirect(coordinator));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/auth/signin?callbackUrl=%2Freservation%2Fhistory%3Freservation_id%3D301',
        { scroll: false }
      );
    });
    expect(mockFetchSingle).not.toHaveBeenCalled();
  });

  it('seeds lookup result into FeedbackSessionCoordinator and redirects to resolved role route', async () => {
    currentQuery = 'reservation_id=302';
    mockUseSession.mockReturnValue({
      status: 'authenticated',
      data: { user: { id: '20', isMentor: false } },
    });
    const reservation = fromPartial<Reservation>({ id: '302' });
    mockFetchSingle.mockResolvedValueOnce({
      viewerRole: 'mentor',
      reservation,
    });

    const coordinator = createFeedbackSessionCoordinator({
      storage: createInMemoryFeedbackSessionStoragePort(),
    });
    renderHook(() => useReservationHistoryRedirect(coordinator));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/reservation/mentor?tab=history&reservation_id=302',
        { scroll: false }
      );
    });

    expect(
      coordinator.consumeSeededLookup({ userId: '20', reservationId: '302' })
    ).toEqual({
      hit: true,
      result: { viewerRole: 'mentor', reservation },
    });
  });

  it('falls back to session role when lookup rejects or no deep-link reservation ID is present', async () => {
    currentQuery = 'reservation_id=500';
    mockUseSession.mockReturnValue({
      status: 'authenticated',
      data: { user: { id: '20', isMentor: true } },
    });
    mockFetchSingle.mockRejectedValueOnce(new Error('Network error'));

    const coordinator = createFeedbackSessionCoordinator({
      storage: createInMemoryFeedbackSessionStoragePort(),
    });
    renderHook(() => useReservationHistoryRedirect(coordinator));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/reservation/mentor?tab=history&reservation_id=500',
        { scroll: false }
      );
    });
  });
});
