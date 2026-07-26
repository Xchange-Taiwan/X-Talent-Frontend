import { BookingSlot, SlotDurationMinutes } from '@/hooks/useMentorSchedule';
import { ParsedMentorTimeslot } from '@/lib/profile/scheduleHelpers';

export const DURATION_OPTIONS: SlotDurationMinutes[] = [30, 45, 60];

export type SlotFormState = {
  startHour: string;
  startMinute: string;
  durationMinutes: SlotDurationMinutes;
};

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

const SNAP_MINUTE_STEPS = [0, 15, 30, 45];

export function fmtTime(unix: number): string {
  const d = new Date(unix * 1000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function snapMinute(m: number): string {
  const snapped = SNAP_MINUTE_STEPS.reduce((prev, curr) =>
    Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev
  );
  return String(snapped).padStart(2, '0');
}

// Closest 30/45/60 default for the form when editing a slot whose stored
// duration drifted from those values (e.g. legacy block data).
export function snapDuration(m: number): SlotDurationMinutes {
  return DURATION_OPTIONS.reduce((prev, curr) =>
    Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev
  );
}

export function defaultFormForDate(
  existingSlots: ParsedMentorTimeslot[]
): SlotFormState {
  // Default new slot to start right after the latest slot of the day, or 09:00
  // if the day is empty. Round up to the next 15-minute mark so the picker
  // matches its options.
  let startH = 9;
  let startM = 0;
  if (existingSlots.length > 0) {
    const lastSlot = existingSlots.reduce((latest, current) =>
      current.end.getTime() > latest.end.getTime() ? current : latest
    );
    const lastEnd = lastSlot.end;
    startH = lastEnd.getHours();
    startM = lastEnd.getMinutes();

    // If the slot ends on the next day, add 24 hours to trigger capping logic
    if (lastEnd.getDate() !== lastSlot.start.getDate()) {
      startH += 24;
    }

    const snapped = Math.ceil(startM / 15) * 15;
    if (snapped >= 60) {
      startH += 1;
      startM = 0;
    } else {
      startM = snapped;
    }
  }
  if (startH >= 24) {
    startH = 23;
    startM = 45;
  }
  return {
    startHour: String(startH).padStart(2, '0'),
    startMinute: String(startM).padStart(2, '0'),
    durationMinutes: 30,
  };
}
