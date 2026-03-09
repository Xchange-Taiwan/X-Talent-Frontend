import { ParsedMentorTimeslot } from '@/hooks/useMentorSchedule';

export function formatSelectedDate(selectedDate: Date | undefined): string {
  if (!selectedDate) {
    return '';
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(selectedDate);
}

export function formatStartTimeSlot(slot: ParsedMentorTimeslot): string {
  const slotArr = JSON.stringify(slot.formatted)?.split(' ');
  return slotArr ? `${slotArr[1]} ${slotArr[2]}` : '';
}

export function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
