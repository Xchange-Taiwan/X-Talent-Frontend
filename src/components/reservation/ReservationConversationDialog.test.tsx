import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Reservation } from '@/types/reservation';

import { mockReservation } from './mocks';
import ReservationConversationDialog from './ReservationConversationDialog';

function openDialog(reservation: Reservation) {
  render(
    <ReservationConversationDialog
      reservation={reservation}
      sourceRole="mentor"
    />
  );
  fireEvent.click(screen.getByText('查看完整對話'));
}

describe('ReservationConversationDialog', () => {
  it('renders messages in the same order as reservation.messages (chronological, not reversed)', () => {
    const reservation: Reservation = {
      ...mockReservation,
      messages: [
        { content: 'Initial question', role: 'MENTEE' },
        { content: 'First reply', role: 'MENTOR' },
        { content: 'Follow-up question', role: 'MENTEE' },
        { content: 'Final reply', role: 'MENTOR' },
      ],
    };

    openDialog(reservation);

    const bubbles = screen
      .getAllByText(
        /Initial question|First reply|Follow-up question|Final reply/
      )
      .map((el) => el.textContent);

    expect(bubbles).toEqual([
      'Initial question',
      'First reply',
      'Follow-up question',
      'Final reply',
    ]);
  });

  it('hides the role label on a message whose immediately preceding message shares the same role', () => {
    const reservation: Reservation = {
      ...mockReservation,
      messages: [
        { content: 'Hi there', role: 'MENTEE' },
        { content: 'Also this', role: 'MENTEE' },
        { content: 'Sure thing', role: 'MENTOR' },
      ],
    };

    openDialog(reservation);

    expect(screen.getAllByText('學員')).toHaveLength(1);
    expect(screen.getAllByText('導師')).toHaveLength(1);
  });

  it('shows the empty state when there are no messages', () => {
    const reservation: Reservation = { ...mockReservation, messages: [] };

    openDialog(reservation);

    expect(screen.getByText('尚無對話內容')).toBeInTheDocument();
  });

  it('renders avatar initials via the shared getInitials helper (uppercased, whitespace-normalized)', () => {
    const reservation: Reservation = {
      ...mockReservation,
      name: 'jack  chen',
    };

    openDialog(reservation);

    expect(screen.getByText('JC')).toBeInTheDocument();
  });

  it('displays system auto-cancel notice tailored to mentor and mentee roles', () => {
    const reservation: Reservation = {
      ...mockReservation,
      cancelledBy: 'SYSTEM',
    };

    openDialog(reservation);
    expect(
      screen.getByText(
        '因您未於預約開始前 24 小時前確認，系統已自動取消此預約。'
      )
    ).toBeInTheDocument();

    render(
      <ReservationConversationDialog
        reservation={reservation}
        sourceRole="mentee"
      />
    );
    fireEvent.click(screen.getAllByText('查看完整對話')[1]);
    expect(
      screen.getByText(
        '因導師未於預約開始前 24 小時前確認，系統已自動取消此預約。'
      )
    ).toBeInTheDocument();
  });
});
