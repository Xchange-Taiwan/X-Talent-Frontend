import { act, fireEvent, render, screen } from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
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

vi.mock('@/components/reservation/RejectReservationDialog', () => ({
  default: vi.fn(({ onReject, disabled }) => (
    <button
      data-testid="mock-reject-dialog-trigger"
      disabled={disabled}
      onClick={() => {
        onReject({ reason: 'Reject Reason' })?.catch(() => {});
      }}
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
    vi.mocked(useReservationActions).mockReturnValue({
      accept: mockAccept,
      rejectOrCancel: mockRejectOrCancel,
      isMutating: false,
    });
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

    // Renders a single accept button and the mock reject dialog trigger -
    // there is no second, nested confirmation dialog for accept.
    expect(screen.getByRole('button', { name: '接受' })).toBeInTheDocument();
    expect(
      screen.getByTestId('mock-reject-dialog-trigger')
    ).toBeInTheDocument();
    expect(screen.queryByText('接受學員預約')).not.toBeInTheDocument();
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

    const acceptBtn = screen.getByRole('button', { name: '接受' });
    await act(async () => {
      fireEvent.click(acceptBtn);
      // The dialog now awaits onMutationSuccess (schedule.reload) before
      // closing, so let that microtask settle before asserting.
      await Promise.resolve();
    });

    expect(onMutationSuccess).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('sends the optional reply message trimmed when accepting', async () => {
    const accept = vi.fn();
    vi.mocked(useReservationActions).mockReturnValue({
      accept,
      rejectOrCancel: mockRejectOrCancel,
      isMutating: false,
    });

    render(<QuickReplyDialog {...defaultProps} />);

    fireEvent.click(screen.getByText('附上回覆訊息（選填）'));
    fireEvent.change(
      screen.getByPlaceholderText(
        '例如：屆時於 Google Meet 見,請先準備一份履歷。'
      ),
      { target: { value: '  見面時見！  ' } }
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '接受' }));
    });

    expect(accept).toHaveBeenCalledWith(mockReservation, '見面時見！');
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

  it('keeps the dialog open when accept fails (onMutationSuccess is never invoked)', async () => {
    const onMutationSuccess = vi.fn();
    const onOpenChange = vi.fn();

    vi.mocked(useReservationActions).mockReturnValue({
      accept: vi.fn().mockRejectedValue(new Error('accept failed')),
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

    const acceptBtn = screen.getByRole('button', { name: '接受' });
    await act(async () => {
      fireEvent.click(acceptBtn);
      await Promise.resolve();
    });

    expect(onMutationSuccess).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('keeps the dialog open when reject fails (onMutationSuccess is never invoked)', async () => {
    const onMutationSuccess = vi.fn();
    const onOpenChange = vi.fn();

    vi.mocked(useReservationActions).mockReturnValue({
      accept: mockAccept,
      rejectOrCancel: vi.fn().mockRejectedValue(new Error('reject failed')),
      isMutating: false,
    });

    render(
      <QuickReplyDialog
        {...defaultProps}
        onMutationSuccess={onMutationSuccess}
        onOpenChange={onOpenChange}
      />
    );

    const rejectBtn = screen.getByTestId('mock-reject-dialog-trigger');
    await act(async () => {
      fireEvent.click(rejectBtn);
      await Promise.resolve();
    });

    expect(onMutationSuccess).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('blocks Escape-key dismissal while a mutation is in progress, so the shared dialog instance is not closed out from under a subsequently reopened reservation', () => {
    vi.mocked(useReservationActions).mockReturnValue({
      accept: mockAccept,
      rejectOrCancel: mockRejectOrCancel,
      isMutating: true,
    });
    const onOpenChange = vi.fn();

    render(<QuickReplyDialog {...defaultProps} onOpenChange={onOpenChange} />);

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('allows Escape-key dismissal once the mutation has finished (isMutating is false)', () => {
    vi.mocked(useReservationActions).mockReturnValue({
      accept: mockAccept,
      rejectOrCancel: mockRejectOrCancel,
      isMutating: false,
    });
    const onOpenChange = vi.fn();

    render(<QuickReplyDialog {...defaultProps} onOpenChange={onOpenChange} />);

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables dialog buttons when mutation is in progress (isMutating is true)', () => {
    vi.mocked(useReservationActions).mockReturnValue({
      accept: mockAccept,
      rejectOrCancel: mockRejectOrCancel,
      isMutating: true,
    });

    render(<QuickReplyDialog {...defaultProps} />);

    const acceptBtn = screen.getByRole('button', { name: '接受' });
    const rejectBtn = screen.getByTestId('mock-reject-dialog-trigger');

    expect(acceptBtn).toBeDisabled();
    expect(rejectBtn).toBeDisabled();
  });

  it('calls onOpenChange(false) when clicking the profile link under non-mutating state', () => {
    const mockOnOpenChange = vi.fn();
    render(
      <QuickReplyDialog {...defaultProps} onOpenChange={mockOnOpenChange} />
    );

    const nameLink = screen.getByRole('link', { name: 'Bob User' });
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
      <QuickReplyDialog {...defaultProps} onOpenChange={mockOnOpenChange} />
    );

    const nameLink = screen.getByRole('link', { name: 'Bob User' });

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
