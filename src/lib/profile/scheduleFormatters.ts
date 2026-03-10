import { BookingSlot, ParsedMentorTimeslot } from '@/hooks/useMentorSchedule';

export function formatSelectedDate(selectedDate: Date | undefined): string {
  if (!selectedDate) {
    return '';
  }
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(selectedDate);
}

export function formatStartTimeSlot(slot: ParsedMentorTimeslot): string {
  const slotArr = JSON.stringify(slot.formatted)?.split(' ');
  return slotArr ? `${slotArr[1]} ${slotArr[2]}` : '';
}

const timeFormat: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
};

export function formatBookingSlotTime(slot: BookingSlot): string {
  const start = slot.start.toLocaleTimeString('en-US', timeFormat);
  const end = slot.end.toLocaleTimeString('en-US', timeFormat);
  return `${start} – ${end}`;
}

export function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
