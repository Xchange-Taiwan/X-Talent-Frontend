import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Reservation } from '@/types/reservation';

import { mockReservation } from './mocks';
import { ReservationMessagePreview } from './ReservationMessagePreview';

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
});
