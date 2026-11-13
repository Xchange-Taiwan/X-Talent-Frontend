import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ReservationHistoryPage, {
  buildReservationHistoryRedirectHref,
} from './page';

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

describe('/reservation/history email deep-link route (#875 / #760 §7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentQuery = '';
  });

  it('builds role-specific history href preserving reservation_id query parameters', () => {
    expect(
      buildReservationHistoryRedirectHref('mentee', 'reservation_id=101')
    ).toBe('/reservation/mentee?tab=history&reservation_id=101');
    expect(
      buildReservationHistoryRedirectHref(
        'mentor',
        'tab=upcoming&reservation_id=205'
      )
    ).toBe('/reservation/mentor?tab=history&reservation_id=205');
  });

  it('redirects unauthenticated user to /auth/signin preserving callbackUrl', async () => {
    currentQuery = 'reservation_id=101';
    mockUseSession.mockReturnValue({
      status: 'unauthenticated',
      data: null,
    });

    render(<ReservationHistoryPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/auth/signin?callbackUrl=%2Freservation%2Fhistory%3Freservation_id%3D101',
        { scroll: false }
      );
    });
    expect(mockFetchSingle).not.toHaveBeenCalled();
  });

  it('redirects authenticated user to /reservation/mentor when single-reservation lookup resolves role MENTOR', async () => {
    currentQuery = 'reservation_id=205';
    mockUseSession.mockReturnValue({
      status: 'authenticated',
      data: {
        user: { id: '2', isMentor: false },
      },
    });
    mockFetchSingle.mockResolvedValueOnce({
      viewerRole: 'mentor',
      reservation: { id: '205' },
    });

    render(<ReservationHistoryPage />);

    await waitFor(() => {
      expect(mockFetchSingle).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '2',
          reservationId: '205',
          fallbackRole: 'mentee',
        })
      );
      expect(mockReplace).toHaveBeenCalledWith(
        '/reservation/mentor?tab=history&reservation_id=205',
        { scroll: false }
      );
    });
  });

  it('falls back safely to session role when reservation_id is absent or single lookup fails', async () => {
    currentQuery = '';
    mockUseSession.mockReturnValue({
      status: 'authenticated',
      data: {
        user: { id: '1', isMentor: false },
      },
    });

    const { unmount } = render(<ReservationHistoryPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/reservation/mentee?tab=history',
        { scroll: false }
      );
    });
    expect(mockFetchSingle).not.toHaveBeenCalled();
    unmount();

    vi.clearAllMocks();
    currentQuery = 'reservation_id=999';
    mockUseSession.mockReturnValue({
      status: 'authenticated',
      data: {
        user: { id: '2', isMentor: true },
      },
    });
    mockFetchSingle.mockRejectedValueOnce(new Error('500 error'));

    render(<ReservationHistoryPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/reservation/mentor?tab=history&reservation_id=999',
        { scroll: false }
      );
    });
  });
});
