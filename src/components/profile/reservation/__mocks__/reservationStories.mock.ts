import type { BookingSlot } from '@/hooks/useMentorSchedule';

const now = new Date();

/**
 * Generates a Date object relative to the current time, with optional hours and minutes offsets.
 */
export const relativeDate = (
  hoursOffset: number,
  minutesOffset: number = 0
): Date => {
  const d = new Date(now);
  d.setHours(d.getHours() + hoursOffset, minutesOffset, 0, 0);
  return d;
};

/**
 * Shared mock BookingSlots for Storybook stories.
 */
export const mockBookingSlots: BookingSlot[] = [
  {
    start: relativeDate(1), // 1 hour in future
    end: relativeDate(1, 30),
    scheduleId: 501,
    isBooked: false,
  },
  {
    start: relativeDate(2), // 2 hours in future
    end: relativeDate(2, 30),
    scheduleId: 502,
    isBooked: true,
  },
  {
    start: relativeDate(-2), // 2 hours in past
    end: relativeDate(-1, 30),
    scheduleId: 503,
    isBooked: false,
  },
];
