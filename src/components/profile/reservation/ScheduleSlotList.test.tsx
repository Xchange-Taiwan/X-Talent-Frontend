import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { BookingSlot } from '@/lib/profile/bookingAvailability';

import { ScheduleSlotList } from './ScheduleSlotList';

describe('ScheduleSlotList', () => {
  const slots: BookingSlot[] = [
    {
      scheduleId: 101,
      start: new Date('2026-07-26T10:00:00Z'),
      end: new Date('2026-07-26T10:30:00Z'),
      isBooked: false,
      status: null,
    },
    {
      scheduleId: 102,
      start: new Date('2026-07-26T11:00:00Z'),
      end: new Date('2026-07-26T11:30:00Z'),
      isBooked: true,
      status: 'BOOKED',
    },
  ];

  it('renders interactive slot buttons with selection, disabled booked state, and analytics attributes', () => {
    const onSelectSlot = vi.fn();
    render(
      <ScheduleSlotList
        mode="interactive"
        slots={slots}
        monthLoaded={true}
        selectedSlot={slots[0]}
        onSelectSlot={onSelectSlot}
        mentorId="7482008160728084"
      />
    );

    expect(screen.getByText('當日可預約時段')).toBeInTheDocument();

    const openBtn = screen.getByRole('button', { name: /10:00/i });
    const bookedBtn = screen.getByRole('button', { name: /11:00/i });

    expect(openBtn).not.toBeDisabled();
    expect(openBtn).toHaveAttribute(
      'data-analytics-click',
      'profile_booking_slot_select'
    );
    expect(openBtn).toHaveAttribute(
      'data-analytics-param-mentor-id',
      '7482008160728084'
    );
    expect(bookedBtn).toBeDisabled();

    fireEvent.click(openBtn);
    expect(onSelectSlot).toHaveBeenCalledWith(slots[0]);
  });

  it('renders read-only slot badges without button elements in readonly mode', () => {
    render(
      <ScheduleSlotList mode="readonly" slots={[slots[0]]} monthLoaded={true} />
    );

    expect(screen.getByText('當日可預約時段')).toBeInTheDocument();
    expect(screen.getByText(/10:00/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders loading and empty states across both modes', () => {
    const { rerender } = render(
      <ScheduleSlotList mode="readonly" slots={[]} monthLoaded={false} />
    );
    expect(screen.getByText('讀取中…')).toHaveAttribute('aria-busy', 'true');

    rerender(
      <ScheduleSlotList mode="readonly" slots={[]} monthLoaded={true} />
    );
    expect(screen.getByText('無可預約的時段')).toBeInTheDocument();
  });
});
