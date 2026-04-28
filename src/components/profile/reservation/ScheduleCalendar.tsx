'use client';

import dayjs from 'dayjs';
import { useState } from 'react';
import { useSwipeable } from 'react-swipeable';

import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

type ScheduleCalendarSize = 'compact' | 'profile';

interface ScheduleCalendarProps {
  selected: Date;
  onSelect?: (date: Date) => void;
  onMonthChange?: (date: Date) => void;
  allowedDates?: string[];
  showTodayStyle?: boolean;
  readOnly?: boolean;
  disableEmptyDates?: boolean;
  disablePastDates?: boolean;
  highlightAvailableDates?: boolean;
  size?: ScheduleCalendarSize;
  className?: string;
}

const scheduleCalendarSizeClassNames: Record<ScheduleCalendarSize, string> = {
  compact: [
    // Dialog / modal calendar width
    '[--calendar-width:100%]',
    'lg:[--calendar-width:28rem]',

    // Dialog / modal cell size
    // Mobile base meets WCAG AA 44px touch target.
    '[--cell-size:max(1.75rem,44px)]',
    'sm:[--cell-size:2rem]',
    'md:[--cell-size:2rem]',
    'lg:[--cell-size:2.5rem]',

    // Dialog / modal day text size
    '[--calendar-day-font-size:0.875rem]',
    'sm:[--calendar-day-font-size:0.875rem]',
    'md:[--calendar-day-font-size:1rem]',
    'lg:[--calendar-day-font-size:1.125rem]',

    // Dialog / modal weekday text size
    '[--calendar-weekday-font-size:0.8rem]',
    'sm:[--calendar-weekday-font-size:0.8rem]',
    'md:[--calendar-weekday-font-size:1rem]',
    'lg:[--calendar-weekday-font-size:1rem]',

    // Dialog / modal caption / dropdown text size
    '[--calendar-caption-font-size:0.875rem]',
    'sm:[--calendar-caption-font-size:0.875rem]',
    'md:[--calendar-caption-font-size:1rem]',
    'lg:[--calendar-caption-font-size:1.125rem]',

    // Dialog / modal icon size
    '[--calendar-chevron-size:1rem]',
    'md:[--calendar-chevron-size:1.25rem]',
    'lg:[--calendar-chevron-size:1.5rem]',
  ].join(' '),

  profile: [
    // Profile page calendar width
    '[--calendar-width:100%]',

    // Profile page cell size
    // Mobile base meets WCAG AA 44px touch target.
    '[--cell-size:max(2rem,44px)]',
    'min-[700px]:[--cell-size:3.75rem]',
    'min-[900px]:[--cell-size:4rem]',
    '2xl:[--cell-size:3.5rem]',

    // Profile page day text size
    '[--calendar-day-font-size:0.875rem]',
    'min-[700px]:[--calendar-day-font-size:1.25rem]',
    'min-[900px]:[--calendar-day-font-size:1.5rem]',
    '2xl:[--calendar-day-font-size:1.25rem]',

    // Profile page weekday text size
    '[--calendar-weekday-font-size:0.8rem]',
    'min-[700px]:[--calendar-weekday-font-size:1rem]',
    'min-[900px]:[--calendar-weekday-font-size:1.125rem]',
    '2xl:[--calendar-weekday-font-size:1rem]',

    // Profile page caption / dropdown text size
    '[--calendar-caption-font-size:0.875rem]',
    'min-[700px]:[--calendar-caption-font-size:1rem]',
    'min-[900px]:[--calendar-caption-font-size:1.125rem]',
    '2xl:[--calendar-caption-font-size:1rem]',

    // Profile page icon size
    '[--calendar-chevron-size:1rem]',
    'min-[700px]:[--calendar-chevron-size:1.5rem]',
    'min-[900px]:[--calendar-chevron-size:1.75rem]',
    '2xl:[--calendar-chevron-size:1.25rem]',
  ].join(' '),
};

export const ScheduleCalendar = ({
  selected,
  onSelect,
  onMonthChange,
  allowedDates = [],
  showTodayStyle,
  readOnly = false,
  disableEmptyDates = false,
  disablePastDates = false,
  highlightAvailableDates = false,
  size = 'compact',
  className,
}: ScheduleCalendarProps) => {
  const [displayMonth, setDisplayMonth] = useState<Date>(selected);

  const handleSelect = (d: Date | undefined) => {
    if (readOnly || !d) return;
    onSelect?.(d);
  };

  const handleMonthChange = (date: Date) => {
    setDisplayMonth(date);
    onMonthChange?.(date);
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () =>
      handleMonthChange(dayjs(displayMonth).add(1, 'month').toDate()),
    onSwipedRight: () =>
      handleMonthChange(dayjs(displayMonth).subtract(1, 'month').toDate()),
    delta: 50,
    trackMouse: false,
    preventScrollOnSwipe: false,
  });

  const availableDays = highlightAvailableDates
    ? allowedDates.map((dateStr) => new Date(`${dateStr}T00:00:00`))
    : [];

  return (
    <div
      {...swipeHandlers}
      className={cn(
        'touch-pan-y',
        scheduleCalendarSizeClassNames[size],
        className
      )}
    >
      <Calendar
        mode="single"
        captionLayout="dropdown"
        month={displayMonth}
        selected={selected}
        onSelect={handleSelect}
        onMonthChange={handleMonthChange}
        modifiers={{
          available: availableDays,
        }}
        modifiersClassNames={{
          available: 'rdp-day-available',
        }}
        disabled={(day) => {
          if (disablePastDates) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (day < today) {
              return true;
            }
          }

          if (disableEmptyDates) {
            const dateStr = dayjs(day).format('YYYY-MM-DD');

            if (allowedDates.length === 0) {
              return true;
            }

            return !allowedDates.includes(dateStr);
          }

          return false;
        }}
        showTodayStyle={showTodayStyle}
      />
    </div>
  );
};
