import { render, screen } from '@testing-library/react';
import dayjs from 'dayjs';
import { describe, expect, it, vi } from 'vitest';

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

  it('does not render status dots when getDateStatus is not provided', () => {
    render(<ScheduleCalendar {...defaultProps} />);

    const dot = screen.queryByTestId(`status-dot-${formattedTodayStr}`);
    expect(dot).not.toBeInTheDocument();
  });

  it('renders a yellow status dot when getDateStatus returns PENDING', () => {
    const getDateStatus = vi.fn((date: Date) =>
      dayjs(date).format('YYYY-MM-DD') === formattedTodayStr
        ? ('PENDING' as const)
        : null
    );

    render(
      <ScheduleCalendar {...defaultProps} getDateStatus={getDateStatus} />
    );

    const dot = screen.getByTestId(`status-dot-${formattedTodayStr}`);
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('bg-status-warning-default');
  });

  it('renders a green status dot when getDateStatus returns BOOKED', () => {
    const getDateStatus = vi.fn((date: Date) =>
      dayjs(date).format('YYYY-MM-DD') === formattedTomorrowStr
        ? ('BOOKED' as const)
        : null
    );

    render(
      <ScheduleCalendar {...defaultProps} getDateStatus={getDateStatus} />
    );

    const dot = screen.getByTestId(`status-dot-${formattedTomorrowStr}`);
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass('bg-status-success-default');
  });

  it('renders no status dot when getDateStatus returns null', () => {
    const getDateStatus = vi.fn(() => null);

    render(
      <ScheduleCalendar {...defaultProps} getDateStatus={getDateStatus} />
    );

    const dot = screen.queryByTestId(`status-dot-${formattedTodayStr}`);
    expect(dot).not.toBeInTheDocument();
  });
});
