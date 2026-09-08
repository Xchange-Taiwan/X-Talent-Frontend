import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateReservationStatus } from '@/services/reservations';
import type { Reservation } from '@/types/reservation';

import { ReservationList } from './ReservationList';

vi.mock('next-auth/react', async () => {
  const { nextAuthMockFactory } = await import('@/test/mocks/nextAuth');
  return nextAuthMockFactory();
});

// Mock dialogs to render a simple button for callback execution
vi.mock('@/components/reservation/AcceptReservationDialog', () => ({
  __esModule: true,
  default: ({
    onAccept,
    reservation,
    disabled,
  }: {
    onAccept: (payload: { id: string; message: string }) => void;
    reservation: Reservation;
    disabled?: boolean;
  }) => (
    <button
      data-testid="accept-btn"
      disabled={disabled}
      onClick={() =>
        onAccept({ id: reservation.id, message: 'Accept Message' })
      }
    >
      Accept Button
    </button>
  ),
}));

vi.mock('@/components/reservation/RejectReservationDialog', () => ({
  __esModule: true,
  default: ({
    onReject,
    reservation,
    disabled,
  }: {
    onReject: (payload: { id: string; reason: string }) => void;
    reservation: Reservation;
    disabled?: boolean;
  }) => (
    <button
      data-testid="reject-btn"
      disabled={disabled}
      onClick={() => onReject({ id: reservation.id, reason: 'Reject Reason' })}
    >
      Reject Button
    </button>
  ),
}));

vi.mock('@/components/reservation/CancelReservationDialog', () => ({
  __esModule: true,
  default: ({
    onConfirmCancel,
    reservation,
    disabled,
  }: {
    onConfirmCancel: (payload: { id: string; reason: string }) => void;
    reservation: Reservation;
    disabled?: boolean;
  }) => (
    <button
      data-testid="cancel-btn"
      disabled={disabled}
      onClick={() =>
        onConfirmCancel({ id: reservation.id, reason: 'Cancel Reason' })
      }
    >
      Cancel Button
    </button>
  ),
}));

vi.mock('@/components/reservation/ReservationConversationDialog', () => ({
  __esModule: true,
  default: () => <div data-testid="conversation-dialog" />,
}));

// Mock the API client
const { mockUpdateReservationStatus } = vi.hoisted(() => {
  return { mockUpdateReservationStatus: vi.fn().mockResolvedValue({}) };
});

vi.mock('@/services/reservations', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/reservations')>();
  return {
    ...actual,
    updateReservationStatus: mockUpdateReservationStatus,
    acceptReservation: vi
      .fn()
      .mockImplementation(async ({ reservation, myUserId }) => {
        await mockUpdateReservationStatus({
          userId: myUserId,
          reservationId: reservation.id,
          body: {},
        });
      }),
    rejectOrCancelReservation: vi
      .fn()
      .mockImplementation(async ({ reservation, myUserId }) => {
        await mockUpdateReservationStatus({
          userId: myUserId,
          reservationId: reservation.id,
          body: {},
        });
      }),
  };
});

// Mock toast and other modules
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/monitoring', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/monitoring')>();
  return {
    ...actual,
    captureFlowFailure: vi.fn(),
    captureApiFailure: vi.fn(),
  };
});

vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

// Mock ReservationCard for fully isolated testing
vi.mock('./ReservationCard', () => ({
  ReservationCard: ({
    actions,
    item,
    profileHref,
  }: {
    actions?: React.ReactNode;
    item: { id: string; name: string };
    profileHref?: string;
  }) => (
    <div
      data-testid={`reservation-card-${item.id}`}
      data-profile-href={profileHref}
    >
      {item.name}
      {actions}
    </div>
  ),
}));

const mockReservation = {
  id: 'res-abc',
  name: 'Test Partner',
  roleLine: 'Designer',
  date: 'Mon, Jan 01, 2024',
  time: '10:00 am – 11:00 am',
  messages: [],
  scheduleId: 101,
  dtstart: 1700000000,
  dtend: 1700003600,
  senderUserId: 'user-123',
  participantUserId: 'user-456',
  version: 0,
};

describe('ReservationList', () => {
  const mockOnMutationSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers onMutationSuccess with source pending / destinations [upcoming] when accepting in pending-mentor variant', async () => {
    render(
      <ReservationList
        items={[mockReservation]}
        variant="pending-mentor"
        sourceRole="mentor"
        myUserId="user-123"
        onMutationSuccess={mockOnMutationSuccess}
      />
    );

    const acceptBtn = screen.getByTestId('accept-btn');
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(updateReservationStatus).toHaveBeenCalledTimes(1);
    });

    expect(mockOnMutationSuccess).toHaveBeenCalledWith('res-abc', {
      source: 'pending',
      destinations: ['upcoming'],
    });
  });

  it('triggers onMutationSuccess with source pending / destinations [history] when rejecting in pending-mentor variant', async () => {
    render(
      <ReservationList
        items={[mockReservation]}
        variant="pending-mentor"
        sourceRole="mentor"
        myUserId="user-123"
        onMutationSuccess={mockOnMutationSuccess}
      />
    );

    const rejectBtn = screen.getByTestId('reject-btn');
    fireEvent.click(rejectBtn);

    await waitFor(() => {
      expect(updateReservationStatus).toHaveBeenCalledTimes(1);
    });

    expect(mockOnMutationSuccess).toHaveBeenCalledWith('res-abc', {
      source: 'pending',
      destinations: ['history'],
    });
  });

  it('triggers onMutationSuccess with source pending / destinations [history] when cancelling in pending-mentee variant', async () => {
    render(
      <ReservationList
        items={[mockReservation]}
        variant="pending-mentee"
        sourceRole="mentee"
        myUserId="user-123"
        onMutationSuccess={mockOnMutationSuccess}
      />
    );

    const cancelBtn = screen.getByTestId('cancel-btn');
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(updateReservationStatus).toHaveBeenCalledTimes(1);
    });

    expect(mockOnMutationSuccess).toHaveBeenCalledWith('res-abc', {
      source: 'pending',
      destinations: ['history'],
    });
  });

  it('triggers onMutationSuccess with source upcoming / destinations [history] when cancelling in upcoming variant', async () => {
    render(
      <ReservationList
        items={[mockReservation]}
        variant="upcoming"
        sourceRole="mentor"
        myUserId="user-123"
        onMutationSuccess={mockOnMutationSuccess}
      />
    );

    const cancelBtn = screen.getByTestId('cancel-btn');
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(updateReservationStatus).toHaveBeenCalledTimes(1);
    });

    expect(mockOnMutationSuccess).toHaveBeenCalledWith('res-abc', {
      source: 'upcoming',
      destinations: ['history'],
    });
  });

  it('disables dialog buttons while the mutation request is in-flight to prevent double submission', async () => {
    let resolveMutation: (v: unknown) => void = () => {};
    const mutationPromise = new Promise<unknown>((resolve) => {
      resolveMutation = resolve;
    });
    mockUpdateReservationStatus.mockReturnValue(mutationPromise);

    render(
      <ReservationList
        items={[mockReservation]}
        variant="pending-mentor"
        sourceRole="mentor"
        myUserId="user-123"
        onMutationSuccess={mockOnMutationSuccess}
      />
    );

    const acceptBtn = screen.getByTestId('accept-btn');
    const rejectBtn = screen.getByTestId('reject-btn');

    expect(acceptBtn).not.toBeDisabled();
    expect(rejectBtn).not.toBeDisabled();

    // Trigger accept mutation
    fireEvent.click(acceptBtn);

    // During the in-flight mutation, BOTH buttons should be disabled for this item!
    expect(acceptBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();

    // Resolve the mutation
    await act(async () => {
      resolveMutation({});
    });

    await waitFor(() => {
      expect(acceptBtn).not.toBeDisabled();
      expect(rejectBtn).not.toBeDisabled();
    });
  });

  // Counterparty resolution, the self-guard, and profile-link invalidation
  // conditions are all owned and tested by resolveReservationViewer
  // (src/lib/reservation/reservationViewerModel.test.ts) - this is a single
  // thin rendering-level check that ReservationList actually forwards
  // whatever the model resolves.
  it('forwards the resolved profileHref from resolveReservationViewer to the card', () => {
    render(
      <ReservationList
        items={[mockReservation]}
        variant="upcoming"
        sourceRole="mentee"
        myUserId="user-123" // matches senderUserId
      />
    );

    const card = screen.getByTestId('reservation-card-res-abc');
    expect(card).toHaveAttribute('data-profile-href', '/profile/user-456');
  });
});
