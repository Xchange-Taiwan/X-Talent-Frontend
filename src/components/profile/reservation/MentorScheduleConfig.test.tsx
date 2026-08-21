import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { BookingSlot } from '@/hooks/useMentorSchedule';

import { MentorScheduleConfig } from './MentorScheduleConfig';

describe('MentorScheduleConfig', () => {
  const mockSlots: BookingSlot[] = [
    {
      scheduleId: 101,
      start: new Date('2026-07-26T10:00:00Z'),
      end: new Date('2026-07-26T10:30:00Z'),
      isBooked: false,
    },
    {
      scheduleId: 102,
      start: new Date('2026-07-26T11:00:00Z'),
      end: new Date('2026-07-26T11:30:00Z'),
      isBooked: true,
    },
  ];

  const defaultProps = {
    slots: mockSlots,
    monthLoaded: true,
    onReservation: vi.fn(),
  };

  it('renders split view with Booked and Available sections when isOwnMentorProfile is true (default)', () => {
    render(
      <MentorScheduleConfig {...defaultProps} isOwnMentorProfile={true} />
    );

    // Renders headings
    expect(screen.getByText('已預約')).toBeInTheDocument();
    expect(screen.getByText('當日可預約時段')).toBeInTheDocument();

    // Renders slots
    expect(screen.getByText('10:00 AM – 10:30 AM')).toBeInTheDocument();
    expect(screen.getByText('11:00 AM – 11:30 AM')).toBeInTheDocument();
    expect(screen.getByText('已預約 (暫定)')).toBeInTheDocument();
  });

  it('triggers onReservation when booking setup button is clicked', () => {
    const onReservation = vi.fn();
    render(
      <MentorScheduleConfig {...defaultProps} onReservation={onReservation} />
    );

    const setupBtn = screen.getByRole('button', { name: '預約設定' });
    fireEvent.click(setupBtn);
    expect(onReservation).toHaveBeenCalledOnce();
  });

  it('triggers onReservation when a booked slot row is clicked', () => {
    const onReservation = vi.fn();
    render(
      <MentorScheduleConfig {...defaultProps} onReservation={onReservation} />
    );

    const bookedRow = screen.getByText('已預約 (暫定)');
    fireEvent.click(bookedRow);
    expect(onReservation).toHaveBeenCalledOnce();
  });

  it('falls back to original non-split list view when isOwnMentorProfile is false', () => {
    render(
      <MentorScheduleConfig {...defaultProps} isOwnMentorProfile={false} />
    );

    // Original ScheduleSlotList heading
    expect(screen.getByText('當日可預約時段')).toBeInTheDocument();
    expect(screen.queryByText('已預約')).not.toBeInTheDocument();

    // Renders slots in the unified list
    expect(screen.getByText('10:00 AM – 10:30 AM')).toBeInTheDocument();
    expect(screen.getByText('11:00 AM – 11:30 AM')).toBeInTheDocument();
    expect(screen.queryByText('已預約 (暫定)')).not.toBeInTheDocument();
  });

  it('renders loading states for both sections when monthLoaded is false and isOwnMentorProfile is true', () => {
    render(
      <MentorScheduleConfig
        {...defaultProps}
        monthLoaded={false}
        isOwnMentorProfile={true}
      />
    );

    expect(screen.getByText('已預約')).toBeInTheDocument();
    expect(screen.getByText('當日可預約時段')).toBeInTheDocument();
    expect(screen.getAllByText('讀取中…')).toHaveLength(2);
  });

  it('renders empty states for both sections when slots are empty and isOwnMentorProfile is true', () => {
    render(
      <MentorScheduleConfig
        {...defaultProps}
        slots={[]}
        isOwnMentorProfile={true}
      />
    );

    expect(screen.getByText('目前無已預約時段')).toBeInTheDocument();
    expect(screen.getByText('無可預約的時段')).toBeInTheDocument();
  });
});
