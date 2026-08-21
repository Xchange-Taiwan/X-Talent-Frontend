import { render, screen } from '@testing-library/react';
import dayjs from 'dayjs';
import { describe, expect, it, vi } from 'vitest';

import type { BookingSlot } from '@/hooks/useMentorSchedule';

import { ScheduleCalendar } from './ScheduleCalendar';

describe('ScheduleCalendar', () => {
  const today = dayjs();
  const formattedTodayStr = today.format('YYYY-MM-DD');
  const formattedTomorrowStr = today.add(1, 'day').format('YYYY-MM-DD');

  const defaultProps = {
    selected: today.toDate(),
    onSelect: vi.fn(),
    onMonthChange: vi.fn(),
    allowedDates: [formattedTodayStr, formattedTomorrowStr],
    showTodayStyle: true,
  };

  it('renders calendar days successfully', () => {
    render(<ScheduleCalendar {...defaultProps} />);

    // Check that we can see calendar cells (the day number should be visible)
    expect(screen.getByText(today.date().toString())).toBeInTheDocument();
  });

  it('does not render status dots when isOwnMentorProfile is false', () => {
    const generateBookingSlots = vi.fn((dateKey: string): BookingSlot[] => {
      if (dateKey === formattedTodayStr) {
        return [
          {
            start: new Date(),
            end: new Date(),
            scheduleId: 1,
            isBooked: false,
            status: 'PENDING',
          },
        ];
      }
      return [];
    });

    render(
      <ScheduleCalendar
        {...defaultProps}
        isOwnMentorProfile={false}
        generateBookingSlots={generateBookingSlots}
      />
    );

    const dot = screen.queryByTestId(`status-dot-${formattedTodayStr}`);
    expect(dot).not.toBeInTheDocument();
  });

  it('renders yellow status dot when isOwnMentorProfile is true and there is a PENDING booking slot', () => {
    const generateBookingSlots = vi.fn((dateKey: string): BookingSlot[] => {
      if (dateKey === formattedTodayStr) {
        return [
          {
            start: new Date(),
            end: new Date(),
            scheduleId: 1,
            isBooked: false,
            status: 'PENDING',
          },
        ];
      }
      return [];
    });

    render(
      <ScheduleCalendar
        {...defaultProps}
        isOwnMentorProfile={true}
        generateBookingSlots={generateBookingSlots}
      />
    );

    const dot = screen.getByTestId(`status-dot-${formattedTodayStr}`);
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('bg-status-warning-default');
  });

  it('renders green status dot when isOwnMentorProfile is true and all bookings are BOOKED', () => {
    const generateBookingSlots = vi.fn((dateKey: string): BookingSlot[] => {
      if (dateKey === formattedTomorrowStr) {
        return [
          {
            start: new Date(),
            end: new Date(),
            scheduleId: 2,
            isBooked: true,
            status: 'BOOKED',
          },
        ];
      }
      return [];
    });

    render(
      <ScheduleCalendar
        {...defaultProps}
        isOwnMentorProfile={true}
        generateBookingSlots={generateBookingSlots}
      />
    );

    const dot = screen.getByTestId(`status-dot-${formattedTomorrowStr}`);
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('bg-status-success-default');
  });

  it('renders yellow status dot if there is a mix of PENDING and BOOKED bookings', () => {
    const generateBookingSlots = vi.fn((dateKey: string): BookingSlot[] => {
      if (dateKey === formattedTodayStr) {
        return [
          {
            start: new Date(),
            end: new Date(),
            scheduleId: 1,
            isBooked: false,
            status: 'PENDING',
          },
          {
            start: new Date(),
            end: new Date(),
            scheduleId: 2,
            isBooked: true,
            status: 'BOOKED',
          },
        ];
      }
      return [];
    });

    render(
      <ScheduleCalendar
        {...defaultProps}
        isOwnMentorProfile={true}
        generateBookingSlots={generateBookingSlots}
      />
    );

    const dot = screen.getByTestId(`status-dot-${formattedTodayStr}`);
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('bg-status-warning-default');
  });

  it('does not render status dot if generateBookingSlots returns only open/unbooked slots', () => {
    const generateBookingSlots = vi.fn((dateKey: string): BookingSlot[] => {
      if (dateKey === formattedTodayStr) {
        return [
          {
            start: new Date(),
            end: new Date(),
            scheduleId: 1,
            isBooked: false,
            status: null,
          },
        ];
      }
      return [];
    });

    render(
      <ScheduleCalendar
        {...defaultProps}
        isOwnMentorProfile={true}
        generateBookingSlots={generateBookingSlots}
      />
    );

    const dot = screen.queryByTestId(`status-dot-${formattedTodayStr}`);
    expect(dot).not.toBeInTheDocument();
  });
});
