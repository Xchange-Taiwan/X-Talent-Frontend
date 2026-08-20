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

  it('triggers onMutationSuccess with ["pending", "upcoming"] when accepting in pending-mentor variant', async () => {
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

    expect(mockOnMutationSuccess).toHaveBeenCalledWith('res-abc', [
      'pending',
      'upcoming',
    ]);
  });

  it('triggers onMutationSuccess with ["pending", "history"] when rejecting in pending-mentor variant', async () => {
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

    expect(mockOnMutationSuccess).toHaveBeenCalledWith('res-abc', [
      'pending',
      'history',
    ]);
  });

  it('triggers onMutationSuccess with ["pending", "history"] when cancelling in pending-mentee variant', async () => {
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

    expect(mockOnMutationSuccess).toHaveBeenCalledWith('res-abc', [
      'pending',
      'history',
    ]);
  });

  it('triggers onMutationSuccess with ["upcoming", "history"] when cancelling in upcoming variant', async () => {
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

    expect(mockOnMutationSuccess).toHaveBeenCalledWith('res-abc', [
      'upcoming',
      'history',
    ]);
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

  describe('profileHref counterparty resolution in cards', () => {
    it('resolves profileHref to participant when current user is the sender', () => {
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

    it('resolves profileHref to sender when current user is the participant', () => {
      render(
        <ReservationList
          items={[mockReservation]}
          variant="upcoming"
          sourceRole="mentor"
          myUserId="user-456" // matches participantUserId
        />
      );

      const card = screen.getByTestId('reservation-card-res-abc');
      expect(card).toHaveAttribute('data-profile-href', '/profile/user-123');
    });

    it('resolves profileHref to sender (fallback) when myUserId is unmatched / admin', () => {
      render(
        <ReservationList
          items={[mockReservation]}
          variant="upcoming"
          sourceRole="mentor"
          myUserId="user-admin" // unmatched
        />
      );

      const card = screen.getByTestId('reservation-card-res-abc');
      expect(card).toHaveAttribute('data-profile-href', '/profile/user-123');
    });

    it('resolves profileHref to undefined when myUserId is not provided', () => {
      render(
        <ReservationList
          items={[mockReservation]}
          variant="upcoming"
          sourceRole="mentor"
          myUserId={undefined}
        />
      );

      const card = screen.getByTestId('reservation-card-res-abc');
      expect(card).not.toHaveAttribute('data-profile-href');
    });

    it('resolves profileHref to undefined if resolving otherId would equal current user (defensive)', () => {
      const defensiveReservation = {
        ...mockReservation,
        senderUserId: 'user-123',
        participantUserId: 'user-123', // both same
      };

      render(
        <ReservationList
          items={[defensiveReservation]}
          variant="upcoming"
          sourceRole="mentor"
          myUserId="user-123"
        />
      );

      const card = screen.getByTestId(
        `reservation-card-${defensiveReservation.id}`
      );
      expect(card).not.toHaveAttribute('data-profile-href');
    });

    it('resolves correctly when senderUserId is null or missing (prevent crash fallback)', () => {
      const nullSenderRes = {
        ...mockReservation,
        senderUserId: '',
        participantUserId: 'user-456',
      };

      render(
        <ReservationList
          items={[nullSenderRes]}
          variant="upcoming"
          sourceRole="mentor"
          myUserId="user-456"
        />
      );

      const card = screen.getByTestId(`reservation-card-${nullSenderRes.id}`);
      expect(card).not.toHaveAttribute('data-profile-href');
    });

    it('resolves correctly when participantUserId is null or missing (prevent crash fallback)', () => {
      const nullParticipantRes = {
        ...mockReservation,
        senderUserId: 'user-123',
        participantUserId: '',
      };

      render(
        <ReservationList
          items={[nullParticipantRes]}
          variant="upcoming"
          sourceRole="mentor"
          myUserId="user-123"
        />
      );

      const card = screen.getByTestId(
        `reservation-card-${nullParticipantRes.id}`
      );
      expect(card).not.toHaveAttribute('data-profile-href');
    });
  });
});
