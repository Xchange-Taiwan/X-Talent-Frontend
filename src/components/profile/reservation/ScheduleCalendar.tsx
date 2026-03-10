'use client';

import dayjs from 'dayjs';

import { Calendar } from '@/components/ui/calendar';

interface ScheduleCalendarProps {
  selected: Date;
  onSelect?: (date: Date) => void;
  allowedDates?: string[];
  showTodayStyle?: boolean;
  readOnly?: boolean;
  disableEmptyDates?: boolean;
  disablePastDates?: boolean;
  highlightAvailableDates?: boolean;
}

export const ScheduleCalendar = ({
  selected,
  onSelect,
  allowedDates = [],
  showTodayStyle,
  readOnly = false,
  disableEmptyDates = false,
  disablePastDates = false,
  highlightAvailableDates = false,
}: ScheduleCalendarProps) => {
  const handleSelect = (d: Date | undefined) => {
    if (readOnly || !d) return;
    onSelect?.(d);
  };

  const availableDays = highlightAvailableDates
    ? allowedDates.map((dateStr) => new Date(dateStr + 'T00:00:00'))
    : [];

  return (
    <Calendar
      mode="single"
      captionLayout="dropdown"
      selected={selected}
      onSelect={handleSelect}
      className="w-full"
      modifiers={{
        available: availableDays,
      }}
      modifiersStyles={{
        available: {
          backgroundColor: 'hsl(var(--primary) / 0.2)',
          borderRadius: '100%',
        },
      }}
      disabled={(day) => {
        if (disablePastDates) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (day < today) return true;
        }
        if (disableEmptyDates) {
          const dateStr = dayjs(day).format('YYYY-MM-DD');
          if (allowedDates.length === 0) return true;
          return !allowedDates.includes(dateStr);
        }
        return false;
      }}
      showTodayStyle={showTodayStyle}
    />
  );
};
