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

  it('stacks the status dot above the day button even when the day is focused/selected', () => {
    // Regression guard: CalendarDayButton gets z-10 when its day cell is
    // focused (group-data-[focused=true]/day:z-10 in ui/calendar.tsx),
    // which previously painted over this dot (no z-index of its own) and
    // hid it whenever the dotted date was clicked.
    const getDateStatus = vi.fn((date: Date) =>
      dayjs(date).format('YYYY-MM-DD') === formattedTodayStr
        ? ('PENDING' as const)
        : null
    );

    render(
      <ScheduleCalendar {...defaultProps} getDateStatus={getDateStatus} />
    );

    const dot = screen.getByTestId(`status-dot-${formattedTodayStr}`);
    expect(dot).toHaveClass('z-20');
  });

  it('positions the status dot tangent to the day circle for size="profile"', () => {
    // Regression guard for the tangent-placement math: the dot's center is
    // pushed out from the circle's rim by its own radius (via calc()),
    // rather than sitting directly on the rim, so it touches the circle
    // instead of overlapping it. See ScheduleCalendar.tsx for the geometry.
    const getDateStatus = vi.fn((date: Date) =>
      dayjs(date).format('YYYY-MM-DD') === formattedTodayStr
        ? ('PENDING' as const)
        : null
    );

    render(
      <ScheduleCalendar
        {...defaultProps}
        size="profile"
        getDateStatus={getDateStatus}
      />
    );

    const dot = screen.getByTestId(`status-dot-${formattedTodayStr}`);
    expect(dot).toHaveClass('top-[calc(14.6447%-1.4142px)]');
    expect(dot).toHaveClass('right-[calc(14.6447%-1.4142px)]');
    expect(dot).toHaveClass('md:top-[calc(14.6447%-2.1213px)]');
    expect(dot).toHaveClass('md:right-[calc(14.6447%-2.1213px)]');
    expect(dot).toHaveClass('translate-x-1/2');
    expect(dot).toHaveClass('-translate-y-1/2');
  });

  it('keeps the inset dot positioning for the default (compact) size', () => {
    const getDateStatus = vi.fn((date: Date) =>
      dayjs(date).format('YYYY-MM-DD') === formattedTodayStr
        ? ('PENDING' as const)
        : null
    );

    render(
      <ScheduleCalendar {...defaultProps} getDateStatus={getDateStatus} />
    );

    const dot = screen.getByTestId(`status-dot-${formattedTodayStr}`);
    expect(dot).toHaveClass('top-0.5');
    expect(dot).toHaveClass('right-0.5');
    expect(dot).toHaveClass('sm:top-1');
    expect(dot).toHaveClass('sm:right-1');
  });

  it('renders error overlay when hasError is true and calls onRetry on button click', () => {
    const onRetry = vi.fn();
    render(
      <ScheduleCalendar {...defaultProps} hasError={true} onRetry={onRetry} />
    );

    expect(
      screen.getByText('無法載入導師時段，請檢查網路連線')
    ).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: '重新嘗試' });
    expect(retryBtn).toBeInTheDocument();

    retryBtn.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('hides the error overlay when isMonthLoading is true to avoid overlap', () => {
    const onRetry = vi.fn();
    render(
      <ScheduleCalendar
        {...defaultProps}
        hasError={true}
        onRetry={onRetry}
        isMonthLoading={true}
      />
    );

    // The error overlay should NOT be in the document
    expect(
      screen.queryByText('無法載入導師時段，請檢查網路連線')
    ).not.toBeInTheDocument();

    const retryBtn = screen.queryByRole('button', { name: '重新嘗試' });
    expect(retryBtn).not.toBeInTheDocument();
  });
});
