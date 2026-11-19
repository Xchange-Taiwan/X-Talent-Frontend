import { act, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGet = vi.fn<(key: string) => string | null>(() => null);
const mockToString = vi.fn(() => 'tab=history');
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => mockGet(key),
    toString: () => mockToString(),
  }),
  useRouter: () => ({
    replace: mockReplace,
  }),
  usePathname: () => '/reservation/mentee',
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

vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/monitoring', () => ({ captureFlowFailure: vi.fn() }));

vi.mock('@/app/reservation/skeleton', () => ({
  ReservationListSkeleton: () => <div data-testid="reservation-skeleton" />,
}));

import { reservationReadModel } from '@/lib/reservation/reservationReadModel';
import {
  fetchReservations,
  type ReservationState,
} from '@/services/reservations';
import { mockSession, mockUseSession } from '@/test/mocks/nextAuth';

import { ReservationDashboard } from './ReservationDashboard';

const mockFetch = vi.mocked(fetchReservations);

describe('ReservationDashboard Render-1 ?tab=history integration (#939)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reservationReadModel.clear();
    mockGet.mockImplementation((key: string) =>
      key === 'tab' ? 'history' : null
    );
    mockToString.mockReturnValue('tab=history');
    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
    });
  });

  it('shows Skeleton on Render 1 without flashing "目前尚無資料", then renders empty state only after MENTEE_HISTORY settles', async () => {
    let resolveHistory!: (val: { items: []; next_dtend: number }) => void;

    mockFetch.mockImplementation(({ state }: { state: ReservationState }) => {
      if (state === 'MENTEE_HISTORY') {
        return new Promise((resolve) => {
          resolveHistory = resolve;
        });
      }
      return Promise.resolve({ items: [], next_dtend: 0 });
    });

    render(<ReservationDashboard userRole="mentee" />);

    // Render 1 synchronous assertion: Skeleton MUST be visible and empty-state text MUST NOT flash
    expect(screen.getByTestId('reservation-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('目前尚無資料')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockSession.user.id,
          state: 'MENTEE_HISTORY',
        })
      );
    });

    // Still loading history -> still Skeleton, zero premature empty state
    expect(screen.queryByText('目前尚無資料')).not.toBeInTheDocument();

    await act(async () => {
      resolveHistory({ items: [], next_dtend: 0 });
    });

    await waitFor(() => {
      expect(screen.getByText('目前尚無資料')).toBeInTheDocument();
    });
  });
});
