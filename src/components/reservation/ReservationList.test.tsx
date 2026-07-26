import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateReservationStatus } from '@/services/reservations';

import { ReservationList } from './ReservationList';

// Mock dialogs to render a simple button for callback execution
vi.mock('@/components/reservation/AcceptReservationDialog', () => ({
  __esModule: true,
  default: ({ onAccept, reservation }: any) => (
    <button
      data-testid="accept-btn"
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
  default: ({ onReject, reservation }: any) => (
    <button
      data-testid="reject-btn"
      onClick={() => onReject({ id: reservation.id, reason: 'Reject Reason' })}
    >
      Reject Button
    </button>
  ),
}));

vi.mock('@/components/reservation/CancelReservationDialog', () => ({
  __esModule: true,
  default: ({ onConfirmCancel, reservation }: any) => (
    <button
      data-testid="cancel-btn"
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
vi.mock('@/services/reservations', () => ({
  updateReservationStatus: vi.fn().mockResolvedValue({}),
}));

// Mock toast and other modules
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/monitoring', () => ({
  captureFlowFailure: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

// Mock ReservationCard for fully isolated testing
vi.mock('./ReservationCard', () => ({
  ReservationCard: ({ actions, item }: any) => (
    <div data-testid={`reservation-card-${item.id}`}>
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
});
