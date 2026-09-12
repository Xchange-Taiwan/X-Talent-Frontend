'use client';

import dayjs from 'dayjs';
import { Loader2 } from 'lucide-react';
import { createContext, useContext, useMemo, useState } from 'react';
import { DayButton } from 'react-day-picker';
import { useSwipeable } from 'react-swipeable';

import { Button } from '@/components/ui/button';
import {
  Calendar,
  CalendarDayButton,
  CalendarVariant,
} from '@/components/ui/calendar';
import type { BookingStatus } from '@/lib/profile/bookingAvailability';
import { cn } from '@/lib/utils';

type ScheduleCalendarSize = 'compact' | 'profile';

interface CalendarContextType {
  getDateStatus?: (date: Date) => BookingStatus | null;
  size: ScheduleCalendarSize;
}

const CalendarContext = createContext<CalendarContextType | null>(null);

const CustomDayButton = (props: React.ComponentProps<typeof DayButton>) => {
  const ctx = useContext(CalendarContext);
  if (!ctx) return <CalendarDayButton {...props} />;

  const { getDateStatus, size } = ctx;
  const { day } = props;
  const bookingStatus = getDateStatus?.(day.date) ?? null;

  // Only wrap in the extra positioning div when there's actually a dot to
  // place, so viewers/dates with no status dot get the original DOM
  // structure react-day-picker expects (no CSS/layout/focus surprises).
  if (!bookingStatus) return <CalendarDayButton {...props} />;

  return (
    // w-full max-w-[var(--cell-size)] aspect-square mirrors CalendarDayButton's
    // own sizing (!w-full max-w-[var(--cell-size)] aspect-square, in
    // src/components/ui/calendar.tsx) exactly, rather than just capping width.
    // Below the breakpoints where the grid cell is wider than --cell-size, the
    // button shrinks to fit the cell and stays a square via aspect-square; a
    // fixed w-[var(--cell-size)] wrapper wouldn't shrink with it, so the dot
    // would float off the edge of the (now smaller) circle instead of hugging
    // it. --cell-size is a runtime CSS custom property set by this
    // component's size classes above, not a static value, so it can't be
    // expressed as a design token.
    <div className="relative mx-auto flex aspect-square w-full max-w-[var(--cell-size)] items-center justify-center">
      <CalendarDayButton {...props} />
      <span
        data-testid={`status-dot-${dayjs(day.date).format('YYYY-MM-DD')}`}
        className={cn(
          // z-20 beats the day button's own focused-state z-10 (see
          // CalendarDayButton's group-data-[focused=true]/day:z-10 in
          // src/components/ui/calendar.tsx). Without it, selecting or
          // keyboard-focusing a dotted date lifts the button into its own
          // stacking context above this dot, hiding the dot behind the
          // circle entirely.
          'pointer-events-none absolute z-20 size-1 rounded-full md:size-1.5',
          size === 'profile'
            ? // Place the dot so it's externally tangent to the day circle
              // along the top-right diagonal — touching the rim, not
              // overlapping it. The diagonal crosses the circle's edge at
              // (1 - 1/sqrt(2)) / 2 ≈ 14.6447% of the wrapper's side in from
              // each edge; pushing the dot's *center* out from there by its
              // own radius (rather than sitting the center directly on the
              // rim) is what keeps the two circles touching instead of
              // straddling one another. That radius is a fixed px value (it
              // only changes at the `md` breakpoint via size-1/size-1.5:
              // 4px/2 = 2px below md, 6px/2 = 3px at md+), so it's
              // subtracted with calc() rather than folded into the
              // percentage — subtracted px = radius / sqrt(2), i.e.
              // 2/√2 ≈ 1.4142 below md, 3/√2 ≈ 2.1213 at md+. Positioning by
              // percentage of the wrapper, plus a self-relative translate
              // (of the dot's own box), keeps this correct at any
              // --cell-size. Tailwind's static class-name scanner requires
              // literal arbitrary-value strings, so these can't be
              // interpolated from computed constants — the math above is
              // the source of truth to re-derive from if the dot size or
              // offset ever changes.
              'top-[calc(14.6447%-1.4142px)] right-[calc(14.6447%-1.4142px)] translate-x-1/2 -translate-y-1/2 md:top-[calc(14.6447%-2.1213px)] md:right-[calc(14.6447%-2.1213px)]'
            : 'top-0.5 right-0.5 sm:top-1 sm:right-1',
          bookingStatus === 'PENDING'
            ? 'bg-status-warning-default'
            : 'bg-status-success-default'
        )}
      />
    </div>
  );
};

const calendarComponents = { DayButton: CustomDayButton };

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
  /**
   * Show a loading overlay over the grid so the user can tell the displayed
   * month is still being fetched (vs. settled-empty). Swiping/clicking still
   * works; this only adds a visual cue.
   */
  isMonthLoading?: boolean;
  hasError?: boolean;
  onRetry?: () => void;
  size?: ScheduleCalendarSize;
  variant?: CalendarVariant;
  className?: string;
  /** Per-date status dot (e.g. booking state); omit to render no dots. */
  getDateStatus?: (date: Date) => BookingStatus | null;
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
  isMonthLoading = false,
  hasError = false,
  onRetry,
  size = 'compact',
  variant,
  className,
  getDateStatus,
}: ScheduleCalendarProps) => {
  const [displayMonth, setDisplayMonth] = useState<Date>(selected);

  const calendarVariant =
    variant ?? (size === 'profile' ? 'profile' : 'default');

  const handleSelect = (d: Date | undefined) => {
    if (readOnly || hasError || !d) return;
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

  const contextValue = useMemo(
    () => ({ getDateStatus, size }),
    [getDateStatus, size]
  );

  return (
    <CalendarContext.Provider value={contextValue}>
      <div
        {...swipeHandlers}
        className={cn(
          'touch-pan-y',
          scheduleCalendarSizeClassNames[size],
          className
        )}
      >
        <div className="relative" aria-busy={isMonthLoading}>
          <div
            className={cn(
              'transition-opacity',
              (isMonthLoading || hasError) && 'opacity-60'
            )}
          >
            <Calendar
              mode="single"
              variant={calendarVariant}
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
                if (hasError) {
                  return true;
                }

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
              components={calendarComponents}
            />
          </div>
          {isMonthLoading && (
            <div
              aria-live="polite"
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <Loader2 className="text-text-tertiary size-6 animate-spin" />
            </div>
          )}
          {!isMonthLoading && hasError && (
            <div className="bg-background-white/95 absolute inset-x-0 top-[60px] bottom-0 z-10 flex flex-col items-center justify-center p-4 text-center">
              <p className="text-text-secondary mb-3 text-sm">
                無法載入導師時段，請檢查網路連線
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={isMonthLoading}
              >
                重新嘗試
              </Button>
            </div>
          )}
        </div>
      </div>
    </CalendarContext.Provider>
  );
};
