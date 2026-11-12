import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { fromPartial } from '@total-typescript/shoehorn';
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockToast, mockDismiss } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockDismiss: vi.fn(),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
    dismiss: mockDismiss,
  }),
}));

import {
  RESERVATION_CONFLICT_MESSAGE,
  ReservationVersionConflictError,
} from '@/lib/reservation/reservationConflictError';
import { MAX_FEEDBACK_CONTENT_LENGTH } from '@/schemas/meetingFeedbackSchema';
import type { Reservation } from '@/types/reservation';

import MeetingFeedbackDialog from './MeetingFeedbackDialog';

const baseReservation: Reservation = fromPartial<Reservation>({
  id: 'res-730',
  name: 'Emily Chen',
  roleLine: 'UI/UX Designer',
  date: '2026/10/20',
  time: '19:00–19:30',
  messages: [],
  scheduleId: 100,
  dtstart: 1760000000,
  dtend: 1760001800,
  senderUserId: 1,
  participantUserId: 2,
  version: 0,
  feedback: {
    meetingHappened: null,
    rating: null,
    nextStep: 'ANSWER',
  },
});

describe('MeetingFeedbackDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof globalThis.ResizeObserver === 'undefined') {
      globalThis.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }
  });

  it('opens Step 1 attendance question, navigates to 10-star rating (default 10), shows name masking hint & 5-row counter textarea, and submits trimmed payload', async () => {
    const onSubmitFeedback = vi.fn().mockResolvedValue(undefined);

    render(
      <MeetingFeedbackDialog
        reservation={baseReservation}
        onSubmitFeedback={onSubmitFeedback}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '填寫回饋' }));

    expect(screen.getByText('會談是否有進行？')).toBeInTheDocument();
    const nextBtn = screen.getByRole('button', { name: '下一步' });
    expect(nextBtn).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: '是' }));
    expect(nextBtn).not.toBeDisabled();
    fireEvent.click(nextBtn);

    expect(screen.getByText('為本次會談評分')).toBeInTheDocument();
    expect(screen.getByTestId('feedback-name-masking-hint')).toHaveTextContent(
      '公開評價將以遮罩姓名顯示'
    );
    expect(screen.getByTestId('meeting-rating-value')).toHaveTextContent(
      '10 / 10'
    );

    const starGroup = screen.getByRole('radiogroup', { name: '整體滿意度' });
    expect(within(starGroup).getAllByRole('radio')).toHaveLength(10);

    const star10 = within(starGroup).getByRole('radio', { name: '10 分' });
    expect(star10).toHaveAttribute('aria-checked', 'true');

    // Adjust rating via keyboard ArrowLeft from 10 -> 9
    star10.focus();
    fireEvent.keyDown(star10, { key: 'ArrowLeft' });
    expect(screen.getByTestId('meeting-rating-value')).toHaveTextContent(
      '9 / 10'
    );
    expect(
      within(starGroup).getByRole('radio', { name: '9 分' })
    ).toHaveAttribute('aria-checked', 'true');

    const textarea = screen.getByLabelText('評論內容（選填）');
    expect(textarea).toHaveAttribute('rows', '5');
    expect(screen.getByTestId('feedback-content-counter')).toHaveTextContent(
      '0 / 1000'
    );

    const rawComment = '  導師講解非常清楚，幫助很大！  ';
    fireEvent.change(textarea, {
      target: { value: rawComment },
    });
    expect(screen.getByTestId('feedback-content-counter')).toHaveTextContent(
      `${rawComment.length} / 1000`
    );

    fireEvent.click(screen.getByRole('button', { name: '送出' }));

    await waitFor(() => {
      expect(onSubmitFeedback).toHaveBeenCalledTimes(1);
    });
    expect(onSubmitFeedback).toHaveBeenCalledWith({
      meeting_happened: true,
      feedback: {
        rating: 9,
        content: '導師講解非常清楚，幫助很大！',
      },
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: '已送出',
      description: 'X-Talent 已收到您的回饋，謝謝您！',
    });
  });

  it('allows direct submission on Step 2 with default rating 10 and empty comment (1.c.1 / 1.d.1)', async () => {
    const onSubmitFeedback = vi.fn().mockResolvedValue(undefined);

    render(
      <MeetingFeedbackDialog
        reservation={baseReservation}
        onSubmitFeedback={onSubmitFeedback}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '填寫回饋' }));
    fireEvent.click(screen.getByRole('radio', { name: '是' }));
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    fireEvent.click(screen.getByRole('button', { name: '送出' }));

    await waitFor(() => {
      expect(onSubmitFeedback).toHaveBeenCalledWith({
        meeting_happened: true,
        feedback: {
          rating: 10,
          content: '',
        },
      });
    });
  });

  it('resets draft values and step back to Step 1 when manually closed without submitting (1.b.3)', async () => {
    const onSubmitFeedback = vi.fn().mockResolvedValue(undefined);

    render(
      <MeetingFeedbackDialog
        reservation={baseReservation}
        onSubmitFeedback={onSubmitFeedback}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '填寫回饋' }));
    fireEvent.click(screen.getByRole('radio', { name: '是' }));
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    fireEvent.click(screen.getByRole('radio', { name: '7 分' }));
    fireEvent.change(screen.getByLabelText('評論內容（選填）'), {
      target: { value: '未送出的草稿內容' },
    });
    expect(screen.getByTestId('meeting-rating-value')).toHaveTextContent(
      '7 / 10'
    );

    // Manually dismiss dialog via Escape key
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Reopen dialog -> should start fresh at Step 1 with unselected attendance, default 10, and empty comment
    fireEvent.click(screen.getByRole('button', { name: '填寫回饋' }));
    expect(screen.getByText('會談是否有進行？')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一步' })).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: '是' }));
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    expect(screen.getByTestId('meeting-rating-value')).toHaveTextContent(
      '10 / 10'
    );
    expect(screen.getByLabelText('評論內容（選填）')).toHaveValue('');
  });

  it('displays validation error and disables submit when comment exceeds 1000 characters', async () => {
    const onSubmitFeedback = vi.fn().mockResolvedValue(undefined);

    render(
      <MeetingFeedbackDialog
        reservation={baseReservation}
        onSubmitFeedback={onSubmitFeedback}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '填寫回饋' }));
    fireEvent.click(screen.getByRole('radio', { name: '是' }));
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    fireEvent.change(screen.getByLabelText('評論內容（選填）'), {
      target: { value: 'a'.repeat(MAX_FEEDBACK_CONTENT_LENGTH + 1) },
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        `評論內容不可超過 ${MAX_FEEDBACK_CONTENT_LENGTH} 字`
      );
    });
    expect(screen.getByTestId('feedback-content-counter')).toHaveTextContent(
      '1001 / 1000'
    );
    expect(screen.getByRole('button', { name: '送出' })).toBeDisabled();
  });

  it('navigates to Step 2B when selecting 否 and submits meeting_happened=false with enum reason and no feedback key', async () => {
    const onSubmitFeedback = vi.fn().mockResolvedValue(undefined);

    render(
      <MeetingFeedbackDialog
        reservation={baseReservation}
        onSubmitFeedback={onSubmitFeedback}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '填寫回饋' }));
    fireEvent.click(screen.getByRole('radio', { name: '否' }));
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    expect(screen.getByText('未進行會談的原因')).toBeInTheDocument();
    expect(screen.queryByText(/誰沒有進行/)).not.toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: '送出' });
    expect(submitBtn).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: '未出席' }));
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmitFeedback).toHaveBeenCalledWith({
        meeting_happened: false,
        not_happened_reason: 'MENTOR_ABSENT',
      });
    });
  });

  it('shows loading state and prevents duplicate submissions while in flight', async () => {
    let resolveSubmit: () => void = () => {};
    const pendingPromise = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });
    const onSubmitFeedback = vi.fn().mockReturnValue(pendingPromise);

    render(
      <MeetingFeedbackDialog
        reservation={baseReservation}
        onSubmitFeedback={onSubmitFeedback}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '填寫回饋' }));
    fireEvent.click(screen.getByRole('radio', { name: '是' }));
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    const submitBtn = screen.getByRole('button', { name: '送出' });
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    expect(onSubmitFeedback).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /送出中/ })).toBeDisabled();

    await act(async () => {
      resolveSubmit();
    });
  });

  it('preserves form content on submit failure and reopens dialog at the same step when clicking 評論 in failure toast', async () => {
    const onSubmitFeedback = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(undefined);

    render(
      <MeetingFeedbackDialog
        reservation={baseReservation}
        onSubmitFeedback={onSubmitFeedback}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '填寫回饋' }));
    fireEvent.click(screen.getByRole('radio', { name: '是' }));
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    fireEvent.click(screen.getByRole('radio', { name: '8 分' }));
    fireEvent.change(screen.getByLabelText('評論內容（選填）'), {
      target: { value: '保留下來的寶貴評論內容' },
    });

    fireEvent.click(screen.getByRole('button', { name: '送出' }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledTimes(1);
    });

    const failureToastArgs = mockToast.mock.calls[0][0];
    expect(failureToastArgs.variant).toBe('destructive');

    // Render the toast description to verify copy & click "評論" to reopen dialog
    render(<div>{failureToastArgs.description}</div>);
    const reopenBtn = screen.getByRole('button', { name: '評論' });
    expect(reopenBtn).toBeInTheDocument();

    fireEvent.click(reopenBtn);

    await waitFor(() => {
      expect(screen.getByText('為本次會談評分')).toBeInTheDocument();
    });
    expect(screen.getByTestId('meeting-rating-value')).toHaveTextContent(
      '8 / 10'
    );
    expect(screen.getByLabelText('評論內容（選填）')).toHaveValue(
      '保留下來的寶貴評論內容'
    );
  });

  it('resets draft, closes dialog, and shows conflict toast without reopen button on 409 ReservationVersionConflictError', async () => {
    const onSubmitFeedback = vi
      .fn()
      .mockRejectedValueOnce(new ReservationVersionConflictError());

    render(
      <MeetingFeedbackDialog
        reservation={baseReservation}
        onSubmitFeedback={onSubmitFeedback}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '填寫回饋' }));
    fireEvent.click(screen.getByRole('radio', { name: '是' }));
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    fireEvent.click(screen.getByRole('radio', { name: '7 分' }));
    fireEvent.change(screen.getByLabelText('評論內容（選填）'), {
      target: { value: '其他分頁已送出衝突時的草稿' },
    });

    fireEvent.click(screen.getByRole('button', { name: '送出' }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        description: RESERVATION_CONFLICT_MESSAGE,
      });
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // If the dialog is still mounted and reopened, draft was reset cleanly
    fireEvent.click(screen.getByRole('button', { name: '填寫回饋' }));
    expect(screen.getByText('會談是否有進行？')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一步' })).toBeDisabled();
  });
});
