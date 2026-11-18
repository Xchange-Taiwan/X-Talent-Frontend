import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  buildReservationFixture,
  resolveReservationMessages,
} from '@/lib/reservation/reservationProjection';
import type { Reservation } from '@/types/reservation';

import { mockReservation } from './mocks';
import { ReservationMessagePreview } from './ReservationMessagePreview';

vi.mock('@/lib/reservation/reservationProjection', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/lib/reservation/reservationProjection')
    >();
  return {
    ...actual,
    resolveReservationMessages: vi.fn(actual.resolveReservationMessages),
  };
});

describe('ReservationMessagePreview', () => {
  it('renders nothing when there is no mentee or mentor message', () => {
    const reservation: Reservation = {
      ...mockReservation,
      menteeMessage: undefined,
      mentorMessage: undefined,
    };

    const { container } = render(
      <ReservationMessagePreview
        reservation={reservation}
        sourceRole="mentor"
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the mentee and mentor message labels and content when present', () => {
    const reservation: Reservation = {
      ...mockReservation,
      menteeMessage: { content: '學員的問題。' },
      mentorMessage: { content: '導師的回覆。' },
    };

    render(
      <ReservationMessagePreview
        reservation={reservation}
        sourceRole="mentor"
      />
    );

    expect(screen.getByText('學員留言')).toBeInTheDocument();
    expect(screen.getByText('學員的問題。')).toBeInTheDocument();
    expect(screen.getByText('導師回覆')).toBeInTheDocument();
    expect(screen.getByText('導師的回覆。')).toBeInTheDocument();
  });

  it('renders the mentee and mentor messages when variant="card"', () => {
    const reservation: Reservation = {
      ...mockReservation,
      menteeMessage: { content: '學員的問題。' },
      mentorMessage: { content: '導師的回覆。' },
    };

    render(
      <ReservationMessagePreview
        reservation={reservation}
        sourceRole="mentor"
        variant="card"
      />
    );

    expect(screen.getByText('學員留言')).toBeInTheDocument();
    expect(screen.getByText('學員的問題。')).toBeInTheDocument();
    expect(screen.getByText('導師回覆')).toBeInTheDocument();
    expect(screen.getByText('導師的回覆。')).toBeInTheDocument();
  });

  it('opens the full conversation dialog on click', () => {
    const reservation: Reservation = {
      ...mockReservation,
      messages: [{ content: '完整訊息內容', role: 'MENTEE' }],
      menteeMessage: { content: '完整訊息內容' },
    };

    render(
      <ReservationMessagePreview
        reservation={reservation}
        sourceRole="mentor"
      />
    );

    expect(screen.queryByText('完整對話紀錄')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看完整訊息' }));

    expect(screen.getByText('完整對話紀錄')).toBeInTheDocument();
  });

  it('opens the full conversation dialog when Enter is pressed on the preview', () => {
    const reservation: Reservation = {
      ...mockReservation,
      messages: [{ content: '完整訊息內容', role: 'MENTEE' }],
      menteeMessage: { content: '完整訊息內容' },
    };

    render(
      <ReservationMessagePreview
        reservation={reservation}
        sourceRole="mentor"
      />
    );

    fireEvent.keyDown(screen.getByRole('button', { name: '查看完整訊息' }), {
      key: 'Enter',
    });

    expect(screen.getByText('完整對話紀錄')).toBeInTheDocument();
  });

  it('opens the full conversation dialog when Space is pressed on the preview', () => {
    const reservation: Reservation = {
      ...mockReservation,
      messages: [{ content: '完整訊息內容', role: 'MENTEE' }],
      menteeMessage: { content: '完整訊息內容' },
    };

    render(
      <ReservationMessagePreview
        reservation={reservation}
        sourceRole="mentor"
      />
    );

    fireEvent.keyDown(screen.getByRole('button', { name: '查看完整訊息' }), {
      key: ' ',
    });

    expect(screen.getByText('完整對話紀錄')).toBeInTheDocument();
  });

  it('renders both original mentee question ("學員留言") and cancellation reason ("取消原因") when cancelled by mentee (#860)', () => {
    const reservation: Reservation = {
      ...mockReservation,
      cancelledBy: 'MENTEE',
      messages: [
        { content: '原本的預約提問 M1', role: 'MENTEE' },
        { content: '臨時有事的取消原因 M2', role: 'MENTEE' },
      ],
      menteeMessage: { content: '臨時有事的取消原因 M2', role: 'MENTEE' },
    };

    render(
      <ReservationMessagePreview
        reservation={reservation}
        sourceRole="mentee"
        variant="card"
      />
    );

    expect(screen.getByText('學員留言')).toBeInTheDocument();
    expect(screen.getByText('原本的預約提問 M1')).toBeInTheDocument();
    expect(screen.getByText('取消原因')).toBeInTheDocument();
    expect(screen.getByText('臨時有事的取消原因 M2')).toBeInTheDocument();
  });

  it('reads pre-projected message fields directly off Reservation without re-running resolveReservationMessages (#932)', () => {
    const preProjected = buildReservationFixture({
      id: 'res-proj-preview',
      cancelledBy: 'MENTOR',
      messages: [
        { content: '預先投影提問 Q1', role: 'MENTEE' },
        { content: '預先投影取消原因 R1', role: 'MENTOR' },
      ],
    });

    vi.mocked(resolveReservationMessages).mockClear();

    render(
      <ReservationMessagePreview
        reservation={preProjected}
        sourceRole="mentee"
        variant="card"
      />
    );

    expect(screen.getByText('預先投影提問 Q1')).toBeInTheDocument();
    expect(screen.getByText('預先投影取消原因 R1')).toBeInTheDocument();
    expect(resolveReservationMessages).not.toHaveBeenCalled();
  });

  it('re-runs resolveReservationMessages on raw cancelled fixtures that omit mentorMessage or menteeMessage alongside cancelReasonMessage (#932)', () => {
    const rawOmittedMentorReply: Reservation = {
      ...mockReservation,
      cancelledBy: 'MENTEE',
      messages: [
        { content: '原始預約提問 Q1', role: 'MENTEE' },
        { content: '導師先前確認回覆 A1', role: 'MENTOR' },
        { content: '學員取消原因 C1', role: 'MENTEE', isCancelReason: true },
      ],
      menteeMessage: { content: '原始預約提問 Q1', role: 'MENTEE' },
      mentorMessage: undefined,
      cancelReasonMessage: {
        content: '學員取消原因 C1',
        role: 'MENTEE',
        isCancelReason: true,
      },
    };

    vi.mocked(resolveReservationMessages).mockClear();

    const { rerender } = render(
      <ReservationMessagePreview
        reservation={rawOmittedMentorReply}
        sourceRole="mentee"
        variant="card"
      />
    );

    expect(resolveReservationMessages).toHaveBeenCalledWith(
      rawOmittedMentorReply
    );
    expect(screen.getByText('學員留言')).toBeInTheDocument();
    expect(screen.getByText('原始預約提問 Q1')).toBeInTheDocument();
    expect(screen.getByText('導師回覆')).toBeInTheDocument();
    expect(screen.getByText('導師先前確認回覆 A1')).toBeInTheDocument();
    expect(screen.getByText('取消原因')).toBeInTheDocument();
    expect(screen.getByText('學員取消原因 C1')).toBeInTheDocument();

    const rawOmittedMenteeQuestion: Reservation = {
      ...mockReservation,
      cancelledBy: 'MENTOR',
      messages: [
        { content: '原始預約提問 Q2', role: 'MENTEE' },
        {
          content: '導師臨時取消原因 R2',
          role: 'MENTOR',
          isCancelReason: true,
        },
      ],
      menteeMessage: undefined,
      mentorMessage: undefined,
      cancelReasonMessage: {
        content: '導師臨時取消原因 R2',
        role: 'MENTOR',
        isCancelReason: true,
      },
    };

    vi.mocked(resolveReservationMessages).mockClear();

    rerender(
      <ReservationMessagePreview
        reservation={rawOmittedMenteeQuestion}
        sourceRole="mentor"
        variant="card"
      />
    );

    expect(resolveReservationMessages).toHaveBeenCalledWith(
      rawOmittedMenteeQuestion
    );
    expect(screen.getByText('學員留言')).toBeInTheDocument();
    expect(screen.getByText('原始預約提問 Q2')).toBeInTheDocument();
    expect(screen.queryByText('導師回覆')).not.toBeInTheDocument();
    expect(screen.getByText('取消原因')).toBeInTheDocument();
    expect(screen.getByText('導師臨時取消原因 R2')).toBeInTheDocument();
  });
});
