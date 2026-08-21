import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useReservationActions } from '@/hooks/user/reservation/useReservationActions';
import { ListKey } from '@/hooks/user/reservation/useReservationData';
import type { Reservation } from '@/types/reservation';

import { QuickReplyDialog } from './QuickReplyDialog';

const mockAccept = vi.fn();
const mockRejectOrCancel = vi.fn();

vi.mock('@/hooks/user/reservation/useReservationActions', () => ({
  useReservationActions: vi.fn(() => ({
    accept: mockAccept,
    rejectOrCancel: mockRejectOrCancel,
    isMutating: false,
  })),
}));

vi.mock('@/components/reservation/AcceptReservationDialog', () => ({
  default: vi.fn(({ onAccept, disabled }) => (
    <button
      data-testid="mock-accept-dialog-trigger"
      disabled={disabled}
      onClick={() => onAccept({ message: 'Accept Message' })}
    >
      Mock Accept
    </button>
  )),
}));

vi.mock('@/components/reservation/RejectReservationDialog', () => ({
  default: vi.fn(({ onReject, disabled }) => (
    <button
      data-testid="mock-reject-dialog-trigger"
      disabled={disabled}
      onClick={() => onReject({ reason: 'Reject Reason' })}
    >
      Mock Reject
    </button>
  )),
}));

describe('QuickReplyDialog', () => {
  const mockReservation: Reservation = {
    id: 'res-103',
    name: 'Bob User',
    roleLine: 'Mentee',
    date: '2026-07-26',
    time: '12:00 PM – 12:30 PM',
    dtstart: Math.floor(new Date('2026-07-26T12:00:00Z').getTime() / 1000),
    dtend: Math.floor(new Date('2026-07-26T12:30:00Z').getTime() / 1000),
    messages: [],
    menteeMessage: {
      content: 'Hello mentor, I have a question about backend development.',
    },
    scheduleId: 103,
    version: 1,
    senderUserId: 'user-bob',
    participantUserId: 'user-mentor',
  };

  const defaultProps = {
    reservation: mockReservation,
    open: true,
    onOpenChange: vi.fn(),
    myUserId: 'user-mentor',
    onMutationSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when reservation is null or open is false', () => {
    const { rerender } = render(
      <QuickReplyDialog {...defaultProps} open={false} />
    );
    expect(screen.queryByText('待您回復的預約申請')).not.toBeInTheDocument();

    rerender(<QuickReplyDialog {...defaultProps} reservation={null} />);
    expect(screen.queryByText('待您回復的預約申請')).not.toBeInTheDocument();
  });

  it('renders reservation details, mentee message, and action buttons', () => {
    render(<QuickReplyDialog {...defaultProps} />);

    expect(screen.getByText('待您回復的預約申請')).toBeInTheDocument();
    expect(screen.getByText('Bob User')).toBeInTheDocument();
    expect(screen.getByText('Mentee')).toBeInTheDocument();
    expect(screen.getByText('2026-07-26')).toBeInTheDocument();
    expect(screen.getByText('12:00 PM – 12:30 PM')).toBeInTheDocument();
    expect(screen.getByText('學員留言')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Hello mentor, I have a question about backend development.'
      )
    ).toBeInTheDocument();

    // Renders custom mock dialog trigger buttons
    expect(
      screen.getByTestId('mock-accept-dialog-trigger')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('mock-reject-dialog-trigger')
    ).toBeInTheDocument();
  });

  it('calls accept action and handles success correctly', async () => {
    const onMutationSuccess = vi.fn();
    const onOpenChange = vi.fn();

    // Simulate successful accept action (calls onMutationSuccess callback in useReservationActions)
    const state = {
      successCallback: undefined as
        ((id: string, affectedTabs: ListKey[]) => void) | undefined,
    };
    vi.mocked(useReservationActions).mockReturnValue({
      accept: vi.fn().mockImplementation(() => {
        state.successCallback?.('res-103', []);
      }),
      rejectOrCancel: mockRejectOrCancel,
      isMutating: false,
    });

    render(
      <QuickReplyDialog
        {...defaultProps}
        onMutationSuccess={onMutationSuccess}
        onOpenChange={onOpenChange}
      />
    );

    // Get success callback hook config
    const hookConfig = vi.mocked(useReservationActions).mock.calls[0][0];
    state.successCallback = hookConfig.onMutationSuccess;

    const acceptBtn = screen.getByTestId('mock-accept-dialog-trigger');
    await act(async () => {
      fireEvent.click(acceptBtn);
      // The dialog now awaits onMutationSuccess (schedule.reload) before
      // closing, so let that microtask settle before asserting.
      await Promise.resolve();
    });

    expect(onMutationSuccess).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls reject action and handles success correctly', async () => {
    const onMutationSuccess = vi.fn();
    const onOpenChange = vi.fn();

    const state = {
      successCallback: undefined as
        ((id: string, affectedTabs: ListKey[]) => void) | undefined,
    };
    vi.mocked(useReservationActions).mockReturnValue({
      accept: mockAccept,
      rejectOrCancel: vi.fn().mockImplementation(() => {
        state.successCallback?.('res-103', []);
      }),
      isMutating: false,
    });

    render(
      <QuickReplyDialog
        {...defaultProps}
        onMutationSuccess={onMutationSuccess}
        onOpenChange={onOpenChange}
      />
    );

    const hookConfig = vi.mocked(useReservationActions).mock.calls[0][0];
    state.successCallback = hookConfig.onMutationSuccess;

    const rejectBtn = screen.getByTestId('mock-reject-dialog-trigger');
    await act(async () => {
      fireEvent.click(rejectBtn);
      await Promise.resolve();
    });

    expect(onMutationSuccess).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables dialog buttons when mutation is in progress (isMutating is true)', () => {
    vi.mocked(useReservationActions).mockReturnValue({
      accept: mockAccept,
      rejectOrCancel: mockRejectOrCancel,
      isMutating: true,
    });

    render(<QuickReplyDialog {...defaultProps} />);

    const acceptBtn = screen.getByTestId('mock-accept-dialog-trigger');
    const rejectBtn = screen.getByTestId('mock-reject-dialog-trigger');
    const backBtn = screen.getByRole('button', { name: '返回' });

    expect(acceptBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();
    expect(backBtn).toBeDisabled();
  });
});
