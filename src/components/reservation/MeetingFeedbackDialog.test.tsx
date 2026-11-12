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

  it('renders mentor avatar/session header, blur(3px) overlay, ⓘ masking tooltip (no permanent gray banner), 10-star rating, and submits trimmed payload', async () => {
    const onSubmitFeedback = vi.fn().mockResolvedValue(undefined);

    render(
      <MeetingFeedbackDialog
        reservation={baseReservation}
        onSubmitFeedback={onSubmitFeedback}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '填寫回饋' }));

    expect(screen.getByTestId('feedback-dialog-overlay')).toHaveClass(
      'backdrop-blur-[3px]'
    );
    const mentorHeader = screen.getByTestId('feedback-mentor-header');
    expect(within(mentorHeader).getByText('Emily Chen')).toBeInTheDocument();
    expect(
      within(mentorHeader).getByText('2026/10/20 · 19:00–19:30')
    ).toBeInTheDocument();

    expect(screen.getByText('步驟 1 / 2 · 確認會談')).toBeInTheDocument();
    expect(screen.getByText('這場會談是否順利進行？')).toBeInTheDocument();
    const nextBtn = screen.getByRole('button', { name: /下一步/ });
    expect(nextBtn).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: '有進行' }));
    expect(nextBtn).not.toBeDisabled();
    fireEvent.click(nextBtn);

    expect(screen.getByText('步驟 2 / 2 · 交流回饋')).toBeInTheDocument();
    expect(screen.getByText('為本次會議評分')).toBeInTheDocument();

    // No permanent gray masking banner until ⓘ tooltip is triggered
    expect(
      screen.queryByTestId('feedback-name-masking-tooltip')
    ).not.toBeInTheDocument();

    const maskInfoBtn = screen.getByRole('button', { name: '姓名遮罩說明' });
    fireEvent.mouseEnter(maskInfoBtn);
    expect(
      screen.getByTestId('feedback-name-masking-tooltip')
    ).toHaveTextContent('公開評價將以遮罩姓名顯示');
    fireEvent.mouseLeave(maskInfoBtn);
    expect(
      screen.queryByTestId('feedback-name-masking-tooltip')
    ).not.toBeInTheDocument();

    expect(screen.getByTestId('meeting-rating-value')).toHaveTextContent(
      '10 / 10'
    );

    const starGroup = screen.getByRole('radiogroup', { name: '整體滿意度' });
    expect(within(starGroup).getAllByRole('radio')).toHaveLength(10);

    const star10 = within(starGroup).getByRole('radio', { name: '10 分' });
    expect(star10).toHaveAttribute('aria-checked', 'true');

    star10.focus();
    fireEvent.keyDown(star10, { key: 'ArrowLeft' });
    expect(screen.getByTestId('meeting-rating-value')).toHaveTextContent(
      '9 / 10'
    );

    const textarea = screen.getByLabelText(/文字回饋/);
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

    fireEvent.click(screen.getByRole('button', { name: '送出回饋' }));

    await waitFor(() => {
      expect(onSubmitFeedback).toHaveBeenCalledTimes(1);
    });
    expect(onSubmitFeedback).toHaveBeenCalledWith(
      {
        meeting_happened: true,
        feedback: {
          rating: 9,
          content: '導師講解非常清楚，幫助很大！',
        },
      },
      baseReservation
    );

    expect(mockToast).toHaveBeenCalledWith({
      title: '已送出',
      description: 'X-Talent 已收到您的回饋，謝謝您！',
    });
  });

  it('allows direct submission on Step 2 with default rating 10 and empty comment', async () => {
    const onSubmitFeedback = vi.fn().mockResolvedValue(undefined);

    render(
      <MeetingFeedbackDialog
        reservation={baseReservation}
        onSubmitFeedback={onSubmitFeedback}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '填寫回饋' }));
    fireEvent.click(screen.getByRole('radio', { name: '有進行' }));
    fireEvent.click(screen.getByRole('button', { name: /下一步/ }));

    fireEvent.click(screen.getByRole('button', { name: '送出回饋' }));

    await waitFor(() => {
      expect(onSubmitFeedback).toHaveBeenCalledWith(
        {
          meeting_happened: true,
          feedback: {
            rating: 10,
            content: '',
          },
        },
        baseReservation
      );
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
    fireEvent.click(screen.getByRole('radio', { name: '有進行' }));
    fireEvent.click(screen.getByRole('button', { name: /下一步/ }));

    fireEvent.click(screen.getByRole('radio', { name: '7 分' }));
    fireEvent.change(screen.getByLabelText(/文字回饋/), {
      target: { value: '未送出的草稿內容' },
    });
    expect(screen.getByTestId('meeting-rating-value')).toHaveTextContent(
      '7 / 10'
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '填寫回饋' }));
    expect(screen.getByText('這場會談是否順利進行？')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /下一步/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: '有進行' }));
    fireEvent.click(screen.getByRole('button', { name: /下一步/ }));

    expect(screen.getByTestId('meeting-rating-value')).toHaveTextContent(
      '10 / 10'
    );
    expect(screen.getByLabelText(/文字回饋/)).toHaveValue('');
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
    fireEvent.click(screen.getByRole('radio', { name: '有進行' }));
    fireEvent.click(screen.getByRole('button', { name: /下一步/ }));

    fireEvent.change(screen.getByLabelText(/文字回饋/), {
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
    expect(screen.getByRole('button', { name: '送出回饋' })).toBeDisabled();
  });

  it('navigates to Step 2B dual questions (誰沒有進行會談 + 為何沒有成功進行 + 補充說明選填) when selecting 沒有進行', async () => {
    const onSubmitFeedback = vi.fn().mockResolvedValue(undefined);

    render(
      <MeetingFeedbackDialog
        reservation={baseReservation}
        onSubmitFeedback={onSubmitFeedback}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '填寫回饋' }));
    fireEvent.click(screen.getByRole('radio', { name: '沒有進行' }));
    fireEvent.click(screen.getByRole('button', { name: /下一步/ }));

    expect(screen.getByText('未進行會談的原因')).toBeInTheDocument();
    expect(screen.getByText('誰沒有進行會談？')).toBeInTheDocument();
    expect(screen.getByText('為何沒有成功進行？')).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: '送出回饋' });
    expect(submitBtn).toBeDisabled();

    // Selecting only party is not enough; reason is also required
    fireEvent.click(screen.getByRole('radio', { name: '導師' }));
    expect(submitBtn).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: '未出席' }));
    expect(submitBtn).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText(/補充說明/), {
      target: { value: '  等候 15 分鐘未上線  ' },
    });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmitFeedback).toHaveBeenCalledWith(
        {
          meeting_happened: false,
          not_happened_party: 'MENTOR',
          not_happened_reason: 'MENTOR_ABSENT',
          not_happened_note: '等候 15 分鐘未上線',
        },
        baseReservation
      );
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
    fireEvent.click(screen.getByRole('radio', { name: '有進行' }));
    fireEvent.click(screen.getByRole('button', { name: /下一步/ }));

    const submitBtn = screen.getByRole('button', { name: '送出回饋' });
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    expect(onSubmitFeedback).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /送出中/ })).toBeDisabled();

    await act(async () => {
      resolveSubmit();
    });
  });

  it('keeps dialog open with form content preserved and shows red destructive toast on submit failure', async () => {
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
    fireEvent.click(screen.getByRole('radio', { name: '有進行' }));
    fireEvent.click(screen.getByRole('button', { name: /下一步/ }));

    fireEvent.click(screen.getByRole('radio', { name: '8 分' }));
    fireEvent.change(screen.getByLabelText(/文字回饋/), {
      target: { value: '保留下來的寶貴評論內容' },
    });

    fireEvent.click(screen.getByRole('button', { name: '送出回饋' }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: '送出失敗',
        description: '內容已保留，請再試一次。',
      });
    });

    // Dialog remains open with entered rating and text intact for immediate retry
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('meeting-rating-value')).toHaveTextContent(
      '8 / 10'
    );
    expect(screen.getByLabelText(/文字回饋/)).toHaveValue(
      '保留下來的寶貴評論內容'
    );

    // Retry succeeds directly
    fireEvent.click(screen.getByRole('button', { name: '送出回饋' }));
    await waitFor(() => {
      expect(onSubmitFeedback).toHaveBeenCalledTimes(2);
    });
  });

  it('supports multi-session queue progress bar, -5deg stacked back card, and advancing through sessions (#740)', async () => {
    const secondReservation: Reservation = fromPartial<Reservation>({
      ...baseReservation,
      id: 'res-740-2',
      name: 'Alex Wang',
      date: '2026/10/22',
      time: '20:00–20:30',
    });
    const onSubmitFeedback = vi.fn().mockResolvedValue(undefined);
    const onSkipReservation = vi.fn();

    render(
      <MeetingFeedbackDialog
        reservation={baseReservation}
        queue={[baseReservation, secondReservation]}
        defaultOpen={true}
        onSubmitFeedback={onSubmitFeedback}
        onSkipReservation={onSkipReservation}
      />
    );

    expect(screen.getByTestId('feedback-queue-counter')).toHaveTextContent(
      '第 1／2 場'
    );
    expect(
      screen.getByTestId('feedback-queue-progressbar')
    ).toBeInTheDocument();
    expect(screen.getByTestId('feedback-queue-back-card')).toBeInTheDocument();
    expect(screen.getByText('Emily Chen')).toBeInTheDocument();

    // Skip first session -> advances to second session and hides back card on last item
    fireEvent.click(
      screen.getByRole('button', { name: '略過 Emily Chen 這場回饋' })
    );
    expect(onSkipReservation).toHaveBeenCalledWith(baseReservation);

    await waitFor(() => {
      expect(screen.getByTestId('feedback-queue-counter')).toHaveTextContent(
        '第 2／2 場'
      );
    });
    expect(screen.getByText('Alex Wang')).toBeInTheDocument();
    expect(
      screen.queryByTestId('feedback-queue-back-card')
    ).not.toBeInTheDocument();
  });

  it('resets draft, closes dialog, and shows conflict toast on 409 ReservationVersionConflictError', async () => {
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
    fireEvent.click(screen.getByRole('radio', { name: '有進行' }));
    fireEvent.click(screen.getByRole('button', { name: /下一步/ }));

    fireEvent.click(screen.getByRole('radio', { name: '7 分' }));
    fireEvent.change(screen.getByLabelText(/文字回饋/), {
      target: { value: '其他分頁已送出衝突時的草稿' },
    });

    fireEvent.click(screen.getByRole('button', { name: '送出回饋' }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        description: RESERVATION_CONFLICT_MESSAGE,
      });
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('mode="edit" (#731)', () => {
    const ratedReservation: Reservation = fromPartial<Reservation>({
      ...baseReservation,
      id: 'res-731',
      feedback: {
        meetingHappened: true,
        rating: {
          rating: 7,
          content: '原本已送出的評論內容',
          createdAt: 1760000000,
          updatedAt: 1760000000,
          authorName: '王＊明',
          isPublic: true,
        },
        nextStep: null,
      },
    });

    it('skips Step 1 attendance question, prefills existing rating (7, not 10) and 5-row resize-none content, and submits { rating, content } via onUpdateFeedback', async () => {
      const onUpdateFeedback = vi.fn().mockResolvedValue(undefined);

      render(
        <MeetingFeedbackDialog
          mode="edit"
          reservation={ratedReservation}
          onUpdateFeedback={onUpdateFeedback}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: '編輯' }));

      expect(
        screen.queryByText('這場會談是否順利進行？')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: '上一步' })
      ).not.toBeInTheDocument();
      expect(screen.getByText('編輯回饋')).toBeInTheDocument();
      expect(screen.getByTestId('meeting-rating-value')).toHaveTextContent(
        '7 / 10'
      );

      const starGroup = screen.getByRole('radiogroup', { name: '整體滿意度' });
      expect(
        within(starGroup).getByRole('radio', { name: '7 分' })
      ).toHaveAttribute('aria-checked', 'true');

      const textarea = screen.getByLabelText(/文字回饋/);
      expect(textarea).toHaveAttribute('rows', '5');
      expect(textarea).toHaveClass('resize-none');
      expect(textarea).toHaveValue('原本已送出的評論內容');

      fireEvent.click(within(starGroup).getByRole('radio', { name: '9 分' }));
      fireEvent.change(textarea, {
        target: { value: '  修改後的回饋內容，幫助很大！  ' },
      });

      fireEvent.click(screen.getByRole('button', { name: '儲存' }));

      await waitFor(() => {
        expect(onUpdateFeedback).toHaveBeenCalledTimes(1);
      });
      expect(onUpdateFeedback).toHaveBeenCalledWith({
        rating: 9,
        content: '修改後的回饋內容，幫助很大！',
      });
      expect(mockToast).toHaveBeenCalledWith({
        title: '已儲存',
        description: '您的回饋已更新！',
      });
    });

    it('restores saved rating & content (never resetting to 10) when manually closed via 取消 or Escape', async () => {
      const onUpdateFeedback = vi.fn().mockResolvedValue(undefined);

      render(
        <MeetingFeedbackDialog
          mode="edit"
          reservation={ratedReservation}
          onUpdateFeedback={onUpdateFeedback}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: '編輯' }));

      fireEvent.click(screen.getByRole('radio', { name: '4 分' }));
      fireEvent.change(screen.getByLabelText(/文字回饋/), {
        target: { value: '未儲存的暫時草稿' },
      });

      fireEvent.click(screen.getByRole('button', { name: '取消' }));
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: '編輯' }));
      expect(screen.getByTestId('meeting-rating-value')).toHaveTextContent(
        '7 / 10'
      );
      expect(screen.getByLabelText(/文字回饋/)).toHaveValue(
        '原本已送出的評論內容'
      );
    });

    it('keeps edit dialog open with draft preserved and shows red toast on PUT failure, supporting unlimited subsequent edits', async () => {
      const onUpdateFeedback = vi
        .fn()
        .mockRejectedValueOnce(new Error('PUT network error'))
        .mockResolvedValue(undefined);

      render(
        <MeetingFeedbackDialog
          mode="edit"
          reservation={ratedReservation}
          onUpdateFeedback={onUpdateFeedback}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: '編輯' }));
      fireEvent.click(screen.getByRole('radio', { name: '8 分' }));
      fireEvent.change(screen.getByLabelText(/文字回饋/), {
        target: { value: '第一次編輯草稿' },
      });

      fireEvent.click(screen.getByRole('button', { name: '儲存' }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: '儲存失敗',
          description: '內容已保留，請再試一次。',
        });
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('meeting-rating-value')).toHaveTextContent(
        '8 / 10'
      );
      expect(screen.getByLabelText(/文字回饋/)).toHaveValue('第一次編輯草稿');

      fireEvent.click(screen.getByRole('button', { name: '儲存' }));
      await waitFor(() => {
        expect(onUpdateFeedback).toHaveBeenCalledTimes(2);
      });
    });
  });
});
