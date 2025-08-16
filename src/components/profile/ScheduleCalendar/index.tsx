'use client';

import dayjs from 'dayjs';

import { Calendar } from '@/components/ui/calendar';

interface ScheduleCalendarProps {
  selected: Date;
  onSelect?: (date: Date) => void;
  allowedDates?: string[];
}

export const ScheduleCalendar = ({
  selected,
  onSelect,
  allowedDates = [],
}: ScheduleCalendarProps) => {
  const handleSelect = (d: Date | undefined) => {
    if (!d) return;
    onSelect?.(d);
  };

  const formatSelectedDate = (selectedDate: Date | undefined): string => {
    if (!selectedDate) {
      return '';
    }
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Taipei',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(selectedDate);
  };

  return (
    <div className="inline-block w-auto rounded-lg border p-2 shadow-md">
      <div className="px-3 pb-3 pt-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          {formatSelectedDate(selected)}
        </h2>
      </div>
      <Calendar
        mode="single"
        captionLayout="dropdown"
        selected={selected}
        onSelect={handleSelect}
        className="w-full rounded-lg"
        disabled={(day) =>
          allowedDates.length > 0 &&
          !allowedDates.includes(dayjs(day).format('YYYY-MM-DD'))
        }
      />
    </div>
  );
};
