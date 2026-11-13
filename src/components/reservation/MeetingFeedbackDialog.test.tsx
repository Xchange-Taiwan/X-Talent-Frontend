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
  QUEUE_PROMOTE_MS,
  QUEUE_SWIPE_OUT_MS,
} from '@/hooks/user/reservation/useFeedbackQueueMotion';
import {
  RESERVATION_CONFLICT_MESSAGE,
  ReservationVersionConflictError,
} from '@/lib/reservation/reservationConflictError';
import {
  MAX_FEEDBACK_CONTENT_LENGTH,
  MAX_NOT_HAPPENED_NOTE_LENGTH,
} from '@/schemas/meetingFeedbackSchema';
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

  it('renders mentor avatar/session header, teal radio selected styling, right-side ⓘ masking tooltip without inline style, 10-star rating, and submits trimmed payload', async () => {
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

    const happenedRadio = screen.getByRole('radio', { name: '有進行' });
    fireEvent.click(happenedRadio);
    expect(happenedRadio.closest('label')).toHaveClass(
      'border-brand-700',
      'bg-brand-50'
    );
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
    const maskTooltip = screen.getByTestId('feedback-name-masking-tooltip');
    expect(maskTooltip).toHaveTextContent('顯示時不會完整公開姓名與個人資料');
    expect(maskTooltip).toHaveClass(
      'left-full',
      'ml-2',
      'top-1/2',
      '-translate-y-1/2'
    );
    expect(maskTooltip).not.toHaveAttribute('style');
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
    expect(star10).not.toHaveClass('ring-1');

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

  it('navigates to Step 2B (步驟 2 / 2 · 會談狀況), expands 補充說明 only when selecting 其他, collapses and excludes note when switching to another reason, and submits payload without not_happened_party', async () => {
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

    expect(screen.getByText('步驟 2 / 2 · 會談狀況')).toBeInTheDocument();
    expect(screen.getByText('未進行會談的原因')).toBeInTheDocument();
    expect(screen.queryByText('誰沒有進行會談？')).not.toBeInTheDocument();
    expect(screen.getByText('為何沒有成功進行？')).toBeInTheDocument();

    const noteCollapse = screen.getByTestId('not-happened-note-collapse');
    expect(noteCollapse).toHaveAttribute('data-expanded', 'false');

    const submitBtn = screen.getByRole('button', { name: '送出回饋' });
    expect(submitBtn).toBeDisabled();

    for (const label of [
      '雙方時間無法配合',
      '對方未出席',
      '未收到或錯過會議通知',
      '技術／連線問題',
      '其他',
    ]) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    }

    // Selecting a non-OTHER reason enables submit and keeps 補充說明 collapsed
    fireEvent.click(screen.getByRole('radio', { name: '對方未出席' }));
    expect(submitBtn).not.toBeDisabled();
    expect(noteCollapse).toHaveAttribute('data-expanded', 'false');

    // Selecting 其他 smoothly expands 補充說明 with placeholder 「說說發生了什麼事…」
    fireEvent.click(screen.getByRole('radio', { name: '其他' }));
    expect(noteCollapse).toHaveAttribute('data-expanded', 'true');

    const noteTextarea = screen.getByLabelText(/補充說明/);
    expect(noteTextarea).toHaveAttribute('placeholder', '說說發生了什麼事…');
    fireEvent.change(noteTextarea, {
      target: { value: '  等候 15 分鐘未上線  ' },
    });

    // Switching away from 其他 collapses 補充說明 even when draft has text, and omits note on submit
    fireEvent.click(screen.getByRole('radio', { name: '對方未出席' }));
    expect(noteCollapse).toHaveAttribute('data-expanded', 'false');

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmitFeedback).toHaveBeenCalledWith(
        {
          meeting_happened: false,
          not_happened_reason: 'COUNTERPART_ABSENT',
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
    await waitFor(() => {
      expect(onSubmitFeedback).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByRole('button', { name: /送出中/ }));

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
    const progressBar = screen.getByTestId('feedback-queue-progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar.children[0]).toHaveAttribute('data-state', 'current');
    expect(progressBar.children[0]).toHaveClass('bg-brand-700');
    expect(progressBar.children[1]).toHaveAttribute('data-state', 'upcoming');
    expect(progressBar.children[1]).toHaveClass('bg-background-border');

    expect(screen.getByTestId('feedback-queue-back-card')).toBeInTheDocument();
    expect(screen.getByText('Emily Chen')).toBeInTheDocument();

    // Skip first session -> advances to second session, marks first segment pale-teal completed, and hides back card on last item
    fireEvent.click(
      screen.getByRole('button', { name: '略過 Emily Chen 這場回饋' })
    );
    expect(onSkipReservation).toHaveBeenCalledWith(baseReservation);

    await waitFor(() => {
      expect(screen.getByTestId('feedback-queue-counter')).toHaveTextContent(
        '第 2／2 場'
      );
    });
    expect(progressBar.children[0]).toHaveAttribute('data-state', 'completed');
    expect(progressBar.children[0]).toHaveClass('bg-brand-200');
    expect(progressBar.children[1]).toHaveAttribute('data-state', 'current');
    expect(progressBar.children[1]).toHaveClass('bg-brand-700');

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

  it('enforces 1000-char limit on Step 2B 補充說明 for 其他, unblocks submit and hides error when switching to non-OTHER reason, and submits trimmed note for 其他', async () => {
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

    fireEvent.click(screen.getByRole('radio', { name: '其他' }));

    const noteField = screen.getByLabelText(/補充說明/);
    fireEvent.change(noteField, {
      target: { value: 'x'.repeat(MAX_NOT_HAPPENED_NOTE_LENGTH + 1) },
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        `補充說明不可超過 ${MAX_NOT_HAPPENED_NOTE_LENGTH} 字`
      );
    });
    expect(screen.getByTestId('feedback-note-counter')).toHaveTextContent(
      '1001 / 1000'
    );
    const submitBtn = screen.getByRole('button', { name: '送出回饋' });
    expect(submitBtn).toBeDisabled();

    // Switching away from 其他 collapses field, hides alert, and unblocks submit even with over-limit draft
    fireEvent.click(screen.getByRole('radio', { name: '雙方時間無法配合' }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('not-happened-note-collapse')).toHaveAttribute(
      'data-expanded',
      'false'
    );
    expect(submitBtn).not.toBeDisabled();

    // Switching back to 其他 restores preserved draft and re-blocks until fixed
    fireEvent.click(screen.getByRole('radio', { name: '其他' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        `補充說明不可超過 ${MAX_NOT_HAPPENED_NOTE_LENGTH} 字`
      );
    });
    expect(submitBtn).toBeDisabled();

    fireEvent.change(noteField, {
      target: { value: '  臨時改期未同步  ' },
    });
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmitFeedback).toHaveBeenCalledWith(
        {
          meeting_happened: false,
          not_happened_reason: 'OTHER',
          note: '臨時改期未同步',
        },
        baseReservation
      );
    });
  });

  it('pins ⓘ tooltip on click after hover and dismisses only the tooltip (preserving draft) on Escape', async () => {
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
      target: { value: '不能被誤清的評論草稿' },
    });

    const maskInfoBtn = screen.getByRole('button', { name: '姓名遮罩說明' });
    // Hover opens tooltip -> first click pins it instead of closing -> mouseLeave keeps it open
    fireEvent.mouseEnter(maskInfoBtn);
    expect(
      screen.getByTestId('feedback-name-masking-tooltip')
    ).toBeInTheDocument();
    fireEvent.click(maskInfoBtn);
    fireEvent.mouseLeave(maskInfoBtn);
    expect(
      screen.getByTestId('feedback-name-masking-tooltip')
    ).toBeInTheDocument();

    // First Escape dismisses ONLY the tooltip while keeping dialog open and preserving draft
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => {
      expect(
        screen.queryByTestId('feedback-name-masking-tooltip')
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('meeting-rating-value')).toHaveTextContent(
      '7 / 10'
    );
    expect(screen.getByLabelText(/文字回饋/)).toHaveValue(
      '不能被誤清的評論草稿'
    );
  });

  it('ignores outside pointerDown on Radix toast viewport/close button after failed submit so draft stays open', async () => {
    const onSubmitFeedback = vi
      .fn()
      .mockRejectedValueOnce(new Error('Submit failed'));

    const toastViewport = document.createElement('div');
    toastViewport.setAttribute('data-radix-toast-viewport', '');
    const toastCloseBtn = document.createElement('button');
    toastCloseBtn.setAttribute('toast-close', '');
    toastViewport.appendChild(toastCloseBtn);
    document.body.appendChild(toastViewport);

    try {
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
        target: { value: '失敗後點擊 Toast 關閉仍須保留的內容' },
      });

      fireEvent.click(screen.getByRole('button', { name: '送出回饋' }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: '送出失敗',
          description: '內容已保留，請再試一次。',
        });
      });

      fireEvent.pointerDown(toastCloseBtn);
      fireEvent.click(toastCloseBtn);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('meeting-rating-value')).toHaveTextContent(
        '8 / 10'
      );
      expect(screen.getByLabelText(/文字回饋/)).toHaveValue(
        '失敗後點擊 Toast 關閉仍須保留的內容'
      );
    } finally {
      toastViewport.remove();
    }
  });

  it('shows 送出並填下一場 on non-final queue sessions, pale-teal completed segments, advances without skipping items, and shows 送出回饋 on final session (#740)', async () => {
    vi.useFakeTimers();

    const firstReservation = baseReservation;
    const secondReservation: Reservation = fromPartial<Reservation>({
      ...baseReservation,
      id: 'res-740-2',
      name: 'Alex Wang',
      date: '2026/10/22',
      time: '20:00–20:30',
    });
    const thirdReservation: Reservation = fromPartial<Reservation>({
      ...baseReservation,
      id: 'res-740-3',
      name: 'Sarah Lin',
      date: '2026/10/25',
      time: '21:00–21:30',
    });

    const submittedCalls: Array<{
      payload: unknown;
      targetId: string;
    }> = [];
    const skippedIds: string[] = [];

    function QueueParentHarness() {
      const [items, setItems] = React.useState<Reservation[]>([
        firstReservation,
        secondReservation,
        thirdReservation,
      ]);

      return (
        <MeetingFeedbackDialog
          defaultOpen
          reservation={items[0] ?? firstReservation}
          queue={items}
          onSubmitFeedback={async (payload, target) => {
            submittedCalls.push({ payload, targetId: target.id });
            // Simulate React Query cache removing the submitted item from `queue` immediately!
            setItems((prev) => prev.filter((item) => item.id !== target.id));
          }}
          onSkipReservation={(skipped) => {
            skippedIds.push(skipped.id);
            setItems((prev) => prev.filter((item) => item.id !== skipped.id));
          }}
        />
      );
    }

    try {
      render(<QueueParentHarness />);

      expect(screen.getByTestId('feedback-queue-counter')).toHaveTextContent(
        '第 1／3 場'
      );
      expect(screen.getByText('Emily Chen')).toBeInTheDocument();

      // Complete Session 1 (non-final -> button shows 送出並填下一場)
      fireEvent.click(screen.getByRole('radio', { name: '有進行' }));
      fireEvent.click(screen.getByRole('button', { name: /下一步/ }));
      fireEvent.click(screen.getByRole('radio', { name: '8 分' }));
      fireEvent.change(screen.getByLabelText(/文字回饋/), {
        target: { value: '第一場收穫滿滿' },
      });
      expect(
        screen.queryByRole('button', { name: '送出回饋' })
      ).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '送出並填下一場' }));
      });

      expect(submittedCalls).toEqual([
        {
          payload: {
            meeting_happened: true,
            feedback: { rating: 8, content: '第一場收穫滿滿' },
          },
          targetId: 'res-730',
        },
      ]);

      // Enters swiping-out transition; interacting during transition must be ignored
      expect(screen.getByTestId('feedback-dialog-surface')).toHaveAttribute(
        'data-queue-motion',
        'swiping-out'
      );
      fireEvent.click(
        screen.getByRole('button', { name: '略過 Emily Chen 這場回饋' })
      );
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(skippedIds).toHaveLength(0);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Complete swipe-out -> must land on Session 2 (Alex Wang), NOT skip to Sarah Lin, and keep denominator / 3
      await act(async () => {
        vi.advanceTimersByTime(QUEUE_SWIPE_OUT_MS);
      });

      expect(screen.getByTestId('feedback-queue-counter')).toHaveTextContent(
        '第 2／3 場'
      );
      const progressBar = screen.getByTestId('feedback-queue-progressbar');
      expect(progressBar.children[0]).toHaveAttribute(
        'data-state',
        'completed'
      );
      expect(progressBar.children[0]).toHaveClass('bg-brand-200');
      expect(progressBar.children[1]).toHaveAttribute('data-state', 'current');
      expect(progressBar.children[1]).toHaveClass('bg-brand-700');
      expect(progressBar.children[2]).toHaveAttribute('data-state', 'upcoming');

      expect(screen.getByText('Alex Wang')).toBeInTheDocument();
      expect(screen.getByText('步驟 1 / 2 · 確認會談')).toBeInTheDocument();

      // While promoting, skip/Escape are still locked
      expect(screen.getByTestId('feedback-dialog-surface')).toHaveAttribute(
        'data-queue-motion',
        'promoting'
      );
      fireEvent.click(
        screen.getByRole('button', { name: '略過 Alex Wang 這場回饋' })
      );
      expect(skippedIds).toHaveLength(0);

      await act(async () => {
        vi.advanceTimersByTime(QUEUE_PROMOTE_MS);
      });
      expect(screen.getByTestId('feedback-dialog-surface')).toHaveAttribute(
        'data-queue-motion',
        'idle'
      );

      // Verify form values were reset to defaults (10 / 10 and empty comment) for Session 2, and button still shows 送出並填下一場
      fireEvent.click(screen.getByRole('radio', { name: '有進行' }));
      fireEvent.click(screen.getByRole('button', { name: /下一步/ }));
      expect(screen.getByTestId('meeting-rating-value')).toHaveTextContent(
        '10 / 10'
      );
      expect(screen.getByLabelText(/文字回饋/)).toHaveValue('');
      expect(
        screen.getByRole('button', { name: '送出並填下一場' })
      ).toBeInTheDocument();

      // Skip Session 2 -> advances to Session 3 (Sarah Lin)
      fireEvent.click(
        screen.getByRole('button', { name: '略過 Alex Wang 這場回饋' })
      );
      expect(skippedIds).toEqual(['res-740-2']);

      await act(async () => {
        vi.advanceTimersByTime(QUEUE_SWIPE_OUT_MS + QUEUE_PROMOTE_MS);
      });

      expect(screen.getByTestId('feedback-queue-counter')).toHaveTextContent(
        '第 3／3 場'
      );
      expect(screen.getByText('Sarah Lin')).toBeInTheDocument();
      expect(
        screen.queryByTestId('feedback-queue-back-card')
      ).not.toBeInTheDocument();

      // Submit Session 3 (final session -> button shows 送出回饋) -> closes dialog cleanly
      fireEvent.click(screen.getByRole('radio', { name: '有進行' }));
      fireEvent.click(screen.getByRole('button', { name: /下一步/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '送出回饋' }));
      });

      expect(submittedCalls).toHaveLength(2);
      expect(submittedCalls[1]?.targetId).toBe('res-740-3');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
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

  describe('Mentor Option A 2-page flow (#740)', () => {
    const mentorReservation: Reservation = fromPartial<Reservation>({
      ...baseReservation,
      id: 'res-mentor-opt-a',
      name: 'Emily Chen',
      viewerRole: 'MENTOR',
    });

    it('renders disabled 確定送出 initially, submits { meeting_happened: true } directly from Step 1 when 有進行 is selected, and omits Mentor warning box for Mentee', async () => {
      const onSubmitFeedback = vi.fn().mockResolvedValue(undefined);

      render(
        <MeetingFeedbackDialog
          defaultOpen
          hideTrigger
          reservation={mentorReservation}
          onSubmitFeedback={onSubmitFeedback}
        />
      );

      expect(
        screen.queryByRole('button', { name: '確認會談' })
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('feedback-dialog-title')).toHaveTextContent(
        '確認會談'
      );

      const confirmSubmitBtn = screen.getByRole('button', { name: '確定送出' });
      expect(confirmSubmitBtn).toBeDisabled();

      fireEvent.click(screen.getByRole('radio', { name: '有進行' }));
      expect(
        screen.getByRole('button', { name: '確定送出' })
      ).not.toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: '確定送出' }));

      await waitFor(() => {
        expect(onSubmitFeedback).toHaveBeenCalledTimes(1);
      });
      expect(onSubmitFeedback).toHaveBeenCalledWith(
        { meeting_happened: true },
        expect.objectContaining({ id: 'res-mentor-opt-a' })
      );
      expect(mockToast).toHaveBeenCalledWith({
        title: '已送出',
        description: 'X-Talent 已收到您的回饋，謝謝您！',
      });
    });

    it('switches Step 1 button to 下一步 when Mentor selects 沒有進行, displays 5 reasons (without 誰沒有進行會談), expands 1000-char OTHER note, and shows warm-yellow lock/unpublish warning box', async () => {
      const onSubmitFeedback = vi.fn().mockResolvedValue(undefined);

      render(
        <MeetingFeedbackDialog
          defaultOpen
          hideTrigger
          reservation={mentorReservation}
          onSubmitFeedback={onSubmitFeedback}
        />
      );

      fireEvent.click(screen.getByRole('radio', { name: '沒有進行' }));

      expect(
        screen.queryByRole('button', { name: '確定送出' })
      ).not.toBeInTheDocument();
      const nextBtn = screen.getByRole('button', { name: '下一步' });
      expect(nextBtn).not.toBeDisabled();

      fireEvent.click(nextBtn);

      expect(screen.getByText('步驟 2 / 2 · 會談狀況')).toBeInTheDocument();
      expect(screen.getByText('未進行會談的原因')).toBeInTheDocument();
      expect(screen.queryByText(/誰沒有進行會談/)).not.toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '對方未出席' })).toHaveAttribute(
        'value',
        'COUNTERPART_ABSENT'
      );

      const warningBox = screen.getByTestId('mentor-not-happened-warning');
      expect(warningBox).toBeVisible();
      expect(warningBox).toHaveTextContent(
        '送出後不能修改。這場會談不會計入已完成場次，學員的評價也不會公開。'
      );

      expect(
        screen.queryByRole('button', { name: '送出回饋' })
      ).not.toBeInTheDocument();
      const submitBtn = screen.getByRole('button', { name: '送出' });
      expect(submitBtn).toBeDisabled();

      fireEvent.click(screen.getByRole('radio', { name: '其他' }));
      const noteField = screen.getByLabelText(/補充說明/);
      fireEvent.change(noteField, {
        target: { value: 'a'.repeat(1001) },
      });
      expect(submitBtn).toBeDisabled();
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '補充說明不可超過 1000 字'
      );

      fireEvent.change(noteField, {
        target: { value: '  學員因臨時會議未上線  ' },
      });
      await waitFor(() => {
        expect(submitBtn).not.toBeDisabled();
      });

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSubmitFeedback).toHaveBeenCalledWith(
          {
            meeting_happened: false,
            not_happened_reason: 'OTHER',
            note: '學員因臨時會議未上線',
          },
          expect.objectContaining({ id: 'res-mentor-opt-a' })
        );
      });
    });

    it('submits COUNTERPART_ABSENT when Mentor selects 對方未出席 on Step 2 (#760 §4)', async () => {
      const onSubmitFeedback = vi.fn().mockResolvedValue(undefined);

      render(
        <MeetingFeedbackDialog
          defaultOpen
          hideTrigger
          reservation={mentorReservation}
          onSubmitFeedback={onSubmitFeedback}
        />
      );

      fireEvent.click(screen.getByRole('radio', { name: '沒有進行' }));
      fireEvent.click(screen.getByRole('button', { name: '下一步' }));
      fireEvent.click(screen.getByRole('radio', { name: '對方未出席' }));
      fireEvent.click(screen.getByRole('button', { name: '送出' }));

      await waitFor(() => {
        expect(onSubmitFeedback).toHaveBeenCalledWith(
          {
            meeting_happened: false,
            not_happened_reason: 'COUNTERPART_ABSENT',
          },
          expect.objectContaining({ id: 'res-mentor-opt-a' })
        );
      });
    });

    it('does NOT render mentor-not-happened-warning on Mentee Step 2 not-happened', () => {
      render(
        <MeetingFeedbackDialog
          defaultOpen
          hideTrigger
          reservation={fromPartial<Reservation>({
            ...baseReservation,
            id: 'res-mentee-check',
            viewerRole: 'MENTEE',
          })}
          onSubmitFeedback={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('radio', { name: '沒有進行' }));
      fireEvent.click(screen.getByRole('button', { name: /下一步/ }));

      expect(
        screen.queryByTestId('mentor-not-happened-warning')
      ).not.toBeInTheDocument();
    });

    it('cleanly transitions across a mixed-role queue (MENTOR -> MENTEE) with accurate Step 1 buttons, Zod schemas, and payloads', async () => {
      const onSubmitFeedback = vi.fn().mockResolvedValue(undefined);
      const mentorItem = fromPartial<Reservation>({
        ...baseReservation,
        id: 'mixed-mentor-1',
        name: 'Emily Chen',
        viewerRole: 'MENTOR',
      });
      const menteeItem = fromPartial<Reservation>({
        ...baseReservation,
        id: 'mixed-mentee-2',
        name: 'Alex Wang',
        viewerRole: 'MENTEE',
      });

      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      try {
        render(
          <MeetingFeedbackDialog
            defaultOpen
            hideTrigger
            reservation={mentorItem}
            queue={[mentorItem, menteeItem]}
            onSubmitFeedback={onSubmitFeedback}
          />
        );

        // Card 1 (MENTOR): Step 1 shows disabled 確定送出, submits { meeting_happened: true } directly
        expect(screen.getByTestId('feedback-queue-counter')).toHaveTextContent(
          '第 1／2 場'
        );
        expect(screen.getByRole('button', { name: '確定送出' })).toBeDisabled();

        fireEvent.click(screen.getByRole('radio', { name: '有進行' }));
        fireEvent.click(screen.getByRole('button', { name: '確定送出' }));

        await waitFor(() => {
          expect(onSubmitFeedback).toHaveBeenNthCalledWith(
            1,
            { meeting_happened: true },
            expect.objectContaining({ id: 'mixed-mentor-1' })
          );
        });

        // Card 2 (MENTEE): Step 1 switches to 下一步, enters Step 2 rating, and submits { meeting_happened: true, feedback }
        await waitFor(() => {
          expect(
            screen.getByTestId('feedback-queue-counter')
          ).toHaveTextContent('第 2／2 場');
        });
        expect(
          screen.queryByRole('button', { name: '確定送出' })
        ).not.toBeInTheDocument();
        const nextBtn = screen.getByRole('button', { name: '下一步' });
        expect(nextBtn).toBeDisabled();

        fireEvent.click(screen.getByRole('radio', { name: '有進行' }));
        expect(nextBtn).not.toBeDisabled();
        fireEvent.click(nextBtn);

        expect(screen.getByText('為本次會議評分')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('radio', { name: '9 分' }));
        fireEvent.change(screen.getByLabelText(/文字回饋/), {
          target: { value: '收穫滿滿的一場交流！' },
        });

        fireEvent.click(screen.getByRole('button', { name: '送出回饋' }));

        await waitFor(() => {
          expect(onSubmitFeedback).toHaveBeenNthCalledWith(
            2,
            {
              meeting_happened: true,
              feedback: {
                rating: 9,
                content: '收穫滿滿的一場交流！',
              },
            },
            expect.objectContaining({ id: 'mixed-mentee-2' })
          );
        });
      } finally {
        window.matchMedia = originalMatchMedia;
      }
    });

    it('cleanly transitions across a reverse mixed-role queue (MENTEE -> MENTOR) without leaking rating fields into Mentor submission', async () => {
      const onSubmitFeedback = vi.fn().mockResolvedValue(undefined);
      const menteeItem = fromPartial<Reservation>({
        ...baseReservation,
        id: 'rev-mentee-1',
        name: 'Alex Wang',
        viewerRole: 'MENTEE',
      });
      const mentorItem = fromPartial<Reservation>({
        ...baseReservation,
        id: 'rev-mentor-2',
        name: 'Emily Chen',
        viewerRole: 'MENTOR',
      });

      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      try {
        render(
          <MeetingFeedbackDialog
            defaultOpen
            hideTrigger
            reservation={menteeItem}
            queue={[menteeItem, mentorItem]}
            onSubmitFeedback={onSubmitFeedback}
          />
        );

        // Card 1 (MENTEE): rate 8 stars and submit
        fireEvent.click(screen.getByRole('radio', { name: '有進行' }));
        fireEvent.click(screen.getByRole('button', { name: '下一步' }));
        fireEvent.click(screen.getByRole('radio', { name: '8 分' }));
        fireEvent.change(screen.getByLabelText(/文字回饋/), {
          target: { value: '謝謝導師建議' },
        });
        fireEvent.click(screen.getByRole('button', { name: '送出並填下一場' }));

        await waitFor(() => {
          expect(onSubmitFeedback).toHaveBeenNthCalledWith(
            1,
            {
              meeting_happened: true,
              feedback: { rating: 8, content: '謝謝導師建議' },
            },
            expect.objectContaining({ id: 'rev-mentee-1' })
          );
        });

        // Card 2 (MENTOR): Step 1 resets cleanly to disabled 確定送出, and Mentor not-happened shows warning box
        await waitFor(() => {
          expect(
            screen.getByTestId('feedback-queue-counter')
          ).toHaveTextContent('第 2／2 場');
        });
        expect(screen.getByRole('button', { name: '確定送出' })).toBeDisabled();

        fireEvent.click(screen.getByRole('radio', { name: '沒有進行' }));
        fireEvent.click(screen.getByRole('button', { name: '下一步' }));

        expect(
          screen.getByTestId('mentor-not-happened-warning')
        ).toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: '送出回饋' })
        ).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('radio', { name: '對方未出席' }));
        fireEvent.click(screen.getByRole('button', { name: '送出' }));

        await waitFor(() => {
          expect(onSubmitFeedback).toHaveBeenNthCalledWith(
            2,
            {
              meeting_happened: false,
              not_happened_reason: 'COUNTERPART_ABSENT',
            },
            expect.objectContaining({ id: 'rev-mentor-2' })
          );
        });
      } finally {
        window.matchMedia = originalMatchMedia;
      }
    });
  });
});
