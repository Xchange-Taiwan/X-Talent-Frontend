import { act, fireEvent, render, screen } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useReservationActions } from '@/hooks/user/reservation/useReservationActions';
import { useReservationMeetLink } from '@/hooks/user/reservation/useReservationMeetLink';
import type { Reservation } from '@/types/reservation';

import { ConfirmedReservationDialog } from './ConfirmedReservationDialog';

const mockAccept = vi.fn();
const mockRejectOrCancel = vi.fn();
const mockJoinMeet = vi.fn();

vi.mock('@/hooks/user/reservation/useReservationActions', () => ({
  useReservationActions: vi.fn(() => ({
    accept: mockAccept,
    rejectOrCancel: mockRejectOrCancel,
    isMutating: false,
  })),
}));

vi.mock('@/hooks/user/reservation/useReservationMeetLink', () => ({
  useReservationMeetLink: vi.fn(() => ({
    joinMeet: mockJoinMeet,
    isPending: false,
  })),
}));

vi.mock('@/components/reservation/CancelReservationDialog', () => ({
  default: vi.fn(({ onConfirmCancel, disabled }) => (
    <button
      data-testid="mock-cancel-dialog-trigger"
      disabled={disabled}
      onClick={() => {
        onConfirmCancel({ id: 'res-102', reason: 'Cancel Reason' })?.catch(
          () => {}
        );
      }}
    >
      Mock Cancel
    </button>
  )),
}));

describe('ConfirmedReservationDialog', () => {
  const mockReservation: Reservation = {
    id: 'res-102',
    name: 'Alice User',
    roleLine: 'Mentee',
    date: '2026-07-26',
    time: '11:00 AM – 11:30 AM',
    dtstart: Math.floor(new Date('2026-07-26T11:00:00Z').getTime() / 1000),
    dtend: Math.floor(new Date('2026-07-26T11:30:00Z').getTime() / 1000),
    messages: [],
    scheduleId: 102,
    version: 1,
    senderUserId: 'user-alice',
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
    vi.mocked(useReservationActions).mockReturnValue({
      accept: mockAccept,
      rejectOrCancel: mockRejectOrCancel,
      isMutating: false,
    });
    vi.mocked(useReservationMeetLink).mockReturnValue({
      joinMeet: mockJoinMeet,
      isPending: false,
    });
  });

  it('renders nothing when reservation is null or open is false', () => {
    const { rerender } = render(
      <ConfirmedReservationDialog {...defaultProps} open={false} />
    );
    expect(screen.queryByText('已確認預約詳情')).not.toBeInTheDocument();

    rerender(
      <ConfirmedReservationDialog {...defaultProps} reservation={null} />
    );
    expect(screen.queryByText('已確認預約詳情')).not.toBeInTheDocument();
  });

  it('renders reservation details and action buttons', () => {
    render(<ConfirmedReservationDialog {...defaultProps} />);

    expect(screen.getByText('已確認預約詳情')).toBeInTheDocument();
    expect(screen.getByText('Alice User')).toBeInTheDocument();
    expect(screen.getByText('Mentee')).toBeInTheDocument();
    expect(screen.getByText('2026-07-26')).toBeInTheDocument();
    expect(screen.getByText('11:00 AM – 11:30 AM')).toBeInTheDocument();
    expect(screen.getByText('會議連結已寄至您的信箱')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '加入 Google Meet' })
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('mock-cancel-dialog-trigger')
    ).toBeInTheDocument();
  });

  it('triggers joinMeet when Join Google Meet button is clicked', () => {
    render(<ConfirmedReservationDialog {...defaultProps} />);

    const joinBtn = screen.getByRole('button', { name: '加入 Google Meet' });
    fireEvent.click(joinBtn);

    expect(mockJoinMeet).toHaveBeenCalledWith('res-102');
  });

  it('triggers rejectOrCancel when onConfirmCancel is called from cancel dialog', async () => {
    render(<ConfirmedReservationDialog {...defaultProps} />);

    const cancelTrigger = screen.getByTestId('mock-cancel-dialog-trigger');
    await act(async () => {
      fireEvent.click(cancelTrigger);
    });

    expect(mockRejectOrCancel).toHaveBeenCalledWith(
      mockReservation,
      'Cancel Reason',
      'cancel'
    );
  });

  it('disables buttons when in mutating or joining states', () => {
    vi.mocked(useReservationActions).mockReturnValueOnce({
      accept: vi.fn(),
      rejectOrCancel: mockRejectOrCancel,
      isMutating: true,
    });

    render(<ConfirmedReservationDialog {...defaultProps} />);

    const joinBtn = screen.getByRole('button', { name: '加入 Google Meet' });
    const cancelTrigger = screen.getByTestId('mock-cancel-dialog-trigger');

    expect(joinBtn).toBeDisabled();
    expect(cancelTrigger).toBeDisabled();
  });

  it('calls onMutationSuccess and closes the dialog when cancellation is successful', async () => {
    render(<ConfirmedReservationDialog {...defaultProps} />);

    const lastCallArgs = vi.mocked(useReservationActions).mock.calls[0][0];
    expect(lastCallArgs).toBeDefined();
    expect(lastCallArgs.onMutationSuccess).toBeDefined();

    await act(async () => {
      if (lastCallArgs.onMutationSuccess) {
        await lastCallArgs.onMutationSuccess('res-102', [
          'upcoming',
          'history',
        ]);
      }
    });

    expect(defaultProps.onMutationSuccess).toHaveBeenCalled();
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('blocks Escape-key dismissal while a mutation is in progress', () => {
    vi.mocked(useReservationActions).mockReturnValue({
      accept: mockAccept,
      rejectOrCancel: mockRejectOrCancel,
      isMutating: true,
    });
    const onOpenChange = vi.fn();

    render(
      <ConfirmedReservationDialog
        {...defaultProps}
        onOpenChange={onOpenChange}
      />
    );

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('blocks Escape-key dismissal while joining meet is in progress', () => {
    vi.mocked(useReservationMeetLink).mockReturnValue({
      joinMeet: mockJoinMeet,
      isPending: true,
    });
    const onOpenChange = vi.fn();

    render(
      <ConfirmedReservationDialog
        {...defaultProps}
        onOpenChange={onOpenChange}
      />
    );

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('allows Escape-key dismissal when not mutating and not joining', () => {
    const onOpenChange = vi.fn();

    render(
      <ConfirmedReservationDialog
        {...defaultProps}
        onOpenChange={onOpenChange}
      />
    );

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders both Google Meet and Cancel buttons within the footer for Option B', () => {
    render(<ConfirmedReservationDialog {...defaultProps} />);

    const joinBtn = screen.getByRole('button', { name: '加入 Google Meet' });
    const footer = joinBtn.closest('div');
    expect(footer).toBeInTheDocument();

    const cancelTrigger = screen.getByTestId('mock-cancel-dialog-trigger');
    expect(footer).toContainElement(cancelTrigger);
    expect(footer).toContainElement(joinBtn);
  });

  it('renders remaining time countdown badge correctly when reservation is in the future', () => {
    vi.useFakeTimers();
    // Set system time to 2026-07-26 at 10:00:00 UTC (1 hour before reservation start at 11:00:00 UTC)
    vi.setSystemTime(new Date('2026-07-26T10:00:00Z'));

    render(<ConfirmedReservationDialog {...defaultProps} />);

    expect(screen.getByText('1 小時後開始')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('renders mentee message block when reservation.menteeMessage is present', () => {
    const reservationWithMsg: Reservation = {
      ...mockReservation,
      menteeMessage: {
        content: '這是學員的測試留言。',
      },
    };

    render(
      <ConfirmedReservationDialog
        {...defaultProps}
        reservation={reservationWithMsg}
      />
    );

    expect(screen.getByText('學員留言')).toBeInTheDocument();
    expect(screen.getByText('這是學員的測試留言。')).toBeInTheDocument();
  });

  it('calls onOpenChange(false) when clicking the profile link under non-mutating state', () => {
    const mockOnOpenChange = vi.fn();
    render(
      <ConfirmedReservationDialog
        {...defaultProps}
        onOpenChange={mockOnOpenChange}
      />
    );

    const nameLink = screen.getByRole('link', { name: 'Alice User' });
    fireEvent.click(nameLink);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('does NOT call onOpenChange(false) and prevents navigation when clicking the profile link under mutating state', () => {
    vi.mocked(useReservationActions).mockReturnValueOnce(
      fromPartial({
        accept: vi.fn(),
        rejectOrCancel: vi.fn(),
        isMutating: true,
      })
    );

    const mockOnOpenChange = vi.fn();
    render(
      <ConfirmedReservationDialog
        {...defaultProps}
        onOpenChange={mockOnOpenChange}
      />
    );

    const nameLink = screen.getByRole('link', { name: 'Alice User' });

    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault');

    fireEvent(nameLink, clickEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(mockOnOpenChange).not.toHaveBeenCalled();
  });
});
