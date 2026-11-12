import { fromPartial } from '@total-typescript/shoehorn';
import type { Session } from 'next-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRedirect = vi.fn();
const mockGetServerSession = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock('next-auth/next', () => ({
  getServerSession: () => mockGetServerSession(),
}));

import ReservationHistoryPage from './page';

describe('ReservationHistoryPage (/reservation/history) (#733)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated visitors to /auth/signin with encoded callbackUrl preserving reservation_id', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    await ReservationHistoryPage({
      searchParams: Promise.resolve({ reservation_id: '101' }),
    });

    expect(mockRedirect).toHaveBeenCalledWith(
      '/auth/signin?callbackUrl=%2Freservation%2Fhistory%3Freservation_id%3D101'
    );
  });

  it('redirects unauthenticated visitors without query params to /auth/signin?callbackUrl=%2Freservation%2Fhistory', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    await ReservationHistoryPage({
      searchParams: Promise.resolve({}),
    });

    expect(mockRedirect).toHaveBeenCalledWith(
      '/auth/signin?callbackUrl=%2Freservation%2Fhistory'
    );
  });

  it('redirects authenticated users to /reservation/mentee?tab=history&reservation_id={id}', async () => {
    mockGetServerSession.mockResolvedValueOnce(
      fromPartial<Session>({
        user: { id: '12', name: 'Test Mentee', onBoarding: true },
      })
    );

    await ReservationHistoryPage({
      searchParams: Promise.resolve({ reservation_id: '101' }),
    });

    expect(mockRedirect).toHaveBeenCalledWith(
      '/reservation/mentee?tab=history&reservation_id=101'
    );
  });

  it('redirects authenticated users without reservation_id to /reservation/mentee?tab=history', async () => {
    mockGetServerSession.mockResolvedValueOnce(
      fromPartial<Session>({
        user: { id: '12', name: 'Test Mentee', onBoarding: true },
      })
    );

    await ReservationHistoryPage({
      searchParams: Promise.resolve({}),
    });

    expect(mockRedirect).toHaveBeenCalledWith(
      '/reservation/mentee?tab=history'
    );
  });

  it('supports role=mentor query param by redirecting to /reservation/mentor?tab=history&reservation_id={id}', async () => {
    mockGetServerSession.mockResolvedValueOnce(
      fromPartial<Session>({
        user: {
          id: '99',
          name: 'Test Mentor',
          isMentor: true,
          onBoarding: true,
        },
      })
    );

    await ReservationHistoryPage({
      searchParams: Promise.resolve({
        role: 'mentor',
        reservation_id: '202',
      }),
    });

    expect(mockRedirect).toHaveBeenCalledWith(
      '/reservation/mentor?tab=history&reservation_id=202'
    );
  });

  it('falls back to /reservation/mentee when role=mentor is passed by a non-mentor user', async () => {
    mockGetServerSession.mockResolvedValueOnce(
      fromPartial<Session>({
        user: {
          id: '12',
          name: 'Mentee Only',
          isMentor: false,
          onBoarding: true,
        },
      })
    );

    await ReservationHistoryPage({
      searchParams: Promise.resolve({
        role: 'mentor',
        reservation_id: '202',
      }),
    });

    expect(mockRedirect).toHaveBeenCalledWith(
      '/reservation/mentee?tab=history&reservation_id=202'
    );
  });
});
