import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fromPartial } from '@total-typescript/shoehorn';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useReservationActions } from '@/hooks/user/reservation/useReservationActions';
import { ListKey } from '@/hooks/user/reservation/useReservationData';
import { trackEvent } from '@/lib/analytics';
import { mockToast } from '@/test/mocks/useToast';
import type { Reservation } from '@/types/reservation';

import { QuickReplyDialog } from './QuickReplyDialog';

vi.mock('@/components/ui/use-toast', async () => {
  const { useToastMockFactory } = await import('@/test/mocks/useToast');
  return useToastMockFactory();
});

const mockAccept = vi.fn();
const mockRejectOrCancel = vi.fn();

vi.mock('@/hooks/user/reservation/useReservationActions', () => ({
  useReservationActions: vi.fn(() => ({
    accept: mockAccept,
    rejectOrCancel: mockRejectOrCancel,
    isMutating: false,
  })),
}));

vi.mock('@/lib/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics')>();
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

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

  // Regression test: the reset-on-reopen effect previously listed
  // formState.isDirty as a dependency, so react-hook-form flipping it to
  // true on the very first keystroke re-ran the effect and immediately
  // collapsed/cleared the field the user was typing into.
  it('keeps the reply box open and the draft intact while typing character by character', async () => {
    render(<QuickReplyDialog {...defaultProps} />);

    fireEvent.click(screen.getByText('附上回覆訊息（選填）'));
    const textarea = screen.getByPlaceholderText(
      '例如：屆時於 Google Meet 見,請先準備一份履歷。'
    );

    const user = userEvent.setup();
    await user.type(textarea, 'Hi');

    expect(
      screen.queryByPlaceholderText(
        '例如：屆時於 Google Meet 見,請先準備一份履歷。'
      )
    ).toBeInTheDocument();
    expect(textarea).toHaveValue('Hi');
  });

  it('tracks reservation_accepted with has_reply reflecting whether a reply was written', async () => {
    render(<QuickReplyDialog {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '接受' }));
    });

    expect(trackEvent).toHaveBeenCalledWith({
      name: 'reservation_accepted',
      feature: 'reservation',
      metadata: { has_reply: false },
    });

    vi.mocked(trackEvent).mockClear();
    fireEvent.click(screen.getByText('附上回覆訊息（選填）'));
    fireEvent.change(
      screen.getByPlaceholderText(
        '例如：屆時於 Google Meet 見,請先準備一份履歷。'
      ),
      { target: { value: '見面時見！' } }
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '接受' }));
    });

    expect(trackEvent).toHaveBeenCalledWith({
      name: 'reservation_accepted',
      feature: 'reservation',
      metadata: { has_reply: true },
    });
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
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: '接受預約失敗,請稍後再試',
      })
    );
  });

  it('clears the reply draft when the shared dialog is reused for a different reservation', () => {
    const { rerender } = render(<QuickReplyDialog {...defaultProps} />);

    fireEvent.click(screen.getByText('附上回覆訊息（選填）'));
    fireEvent.change(
      screen.getByPlaceholderText(
        '例如：屆時於 Google Meet 見,請先準備一份履歷。'
      ),
      { target: { value: '不好意思，我要遲到了' } }
    );

    const otherReservation: Reservation = {
      ...mockReservation,
      id: 'res-999',
      name: 'Carol User',
    };
    rerender(
      <QuickReplyDialog {...defaultProps} reservation={otherReservation} />
    );

    expect(screen.queryByText('給學員的回覆（選填）')).not.toBeInTheDocument();
    expect(screen.getByText('附上回覆訊息（選填）')).toBeInTheDocument();
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
    // mockReturnValue (not ...Once): the mounted form hook's own internal
    // re-render(s) mean more than one render can happen before the click
    // below, and every one of them must still see isMutating: true.
    vi.mocked(useReservationActions).mockReturnValue(
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
