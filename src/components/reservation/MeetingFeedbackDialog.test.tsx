import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
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

  it('opens Step 1 attendance question, navigates to 1–10 slider (default 10), and submits meeting_happened=true payload', async () => {
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
    expect(screen.getByTestId('meeting-rating-value')).toHaveTextContent(
      '10 / 10'
    );

    const slider = screen.getByRole('slider', { name: '整體滿意度' });
    expect(slider).toHaveAttribute('aria-valuemin', '1');
    expect(slider).toHaveAttribute('aria-valuemax', '10');
    expect(slider).toHaveAttribute('aria-valuenow', '10');

    // Adjust slider via keyboard ArrowLeft from 10 -> 9
    slider.focus();
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(screen.getByTestId('meeting-rating-value')).toHaveTextContent(
      '9 / 10'
    );

    fireEvent.change(screen.getByLabelText('評論內容（選填）'), {
      target: { value: '  導師講解非常清楚，幫助很大！  ' },
    });

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

    fireEvent.click(screen.getByRole('radio', { name: '對方未出席' }));
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
    expect(screen.getByLabelText('評論內容（選填）')).toHaveValue(
      '保留下來的寶貴評論內容'
    );
  });
});
