process.env.TZ = 'UTC';

import { act, renderHook, waitFor } from '@testing-library/react';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/mentor-schedule/sync', () => ({
  loadMonthScheduleCached: vi.fn(),
  loadMonthScheduleFresh: vi.fn(),
  prefetchMonthSchedule: vi.fn(),
  syncMonths: vi.fn(),
}));

import { useMentorSchedule } from '@/hooks/useMentorSchedule';
import {
  buildDateTime,
  RawMentorTimeslot,
} from '@/lib/profile/scheduleHelpers';
import { loadMonthScheduleCached } from '@/services/mentor-schedule/sync';

const mockLoadMonthScheduleCached = vi.mocked(loadMonthScheduleCached);

describe('useMentorSchedule', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const defaultMockRaws: RawMentorTimeslot[] = [
    {
      id: 101,
      type: 'ALLOW' as const,
      dtstart: 1774390000,
      dtend: 1774391800,
      rrule: undefined,
      exdate: [],
    },
  ];

  function setupSchedule(mockRaws: RawMentorTimeslot[] = defaultMockRaws) {
    mockLoadMonthScheduleCached.mockReturnValue({
      cached: mockRaws,
      revalidate: Promise.resolve(mockRaws),
    });

    return renderHook(() =>
      useMentorSchedule({
        backend: { userId: '123', year: 2026, month: 7 },
      })
    );
  }

  it('correctly maps occurrenceId in parsedDraft on load', async () => {
    const { result } = setupSchedule();

    // Initial load from cache
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.parsedDraft).toHaveLength(1);
    const slot = result.current.parsedDraft[0];
    expect(slot.occurrenceId).toBe('101_1774390000');
    expect(slot.id).toBe(101);
    expect(slot.occurrenceUnix).toBe(1774390000);
  });

  it('correctly updates a draft slot', async () => {
    const { result } = setupSchedule();

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    act(() => {
      const success = result.current.updateDraftSlot(101, 1774390000, {
        startTime: '13:00',
        durationMinutes: 45,
      });
      expect(success).toBe(true);
    });

    const baseDate = dayjs(1774390000 * 1000).format('YYYY-MM-DD');
    const expectedTime = buildDateTime(baseDate, '13:00');
    const expectedUnix = Math.floor(expectedTime.valueOf() / 1000);

    expect(result.current.parsedDraft).toHaveLength(1);
    const updatedSlot = result.current.parsedDraft[0];
    expect(updatedSlot.occurrenceUnix).toBe(expectedUnix);
    expect(updatedSlot.durationMinutes).toBe(45);
  });

  it('correctly deletes a draft slot', async () => {
    const { result } = setupSchedule();

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.parsedDraft).toHaveLength(1);

    act(() => {
      result.current.deleteDraftSlot(101, 1774390000);
    });

    expect(result.current.parsedDraft).toHaveLength(0);
  });

  it('prevents updateDraftSlot when it causes an overlap conflict', async () => {
    const baseDate = dayjs(1774390000 * 1000).format('YYYY-MM-DD');

    // Slot 102 will start at 13:45 in local timezone
    const slot102Start = buildDateTime(baseDate, '13:45');
    const slot102StartUnix = Math.floor(slot102Start.valueOf() / 1000);

    const mockRaws: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: 1774390000,
        dtend: 1774391800,
        rrule: undefined,
        exdate: [],
      },
      {
        id: 102,
        type: 'ALLOW' as const,
        dtstart: slot102StartUnix,
        dtend: slot102StartUnix + 1800, // +30 mins
        rrule: undefined,
        exdate: [],
      },
    ];

    const { result } = setupSchedule(mockRaws);

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    act(() => {
      // Slot 101 starts at 13:30, ends at 14:15 (45 mins duration).
      // Slot 102 starts at 13:45, ends at 14:15.
      // This is a direct overlap conflict!
      const success = result.current.updateDraftSlot(101, 1774390000, {
        startTime: '13:30',
        durationMinutes: 45,
      });
      expect(success).toBe(false);
    });

    // Check that slot 101 is unchanged
    const slot101 = result.current.parsedDraft.find((s) => s.id === 101);
    expect(slot101?.occurrenceUnix).toBe(1774390000);
  });

  it('correctly detaches a single occurrence of a recurring slot on update', async () => {
    const mockRaws: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: 1774390000, // occurrence 1 (July 26, 2026 12:46:40 PM UTC)
        dtend: 1774391800,
        rrule: 'FREQ=WEEKLY;COUNT=2', // next is 1774994800 (August 2, 2026 12:46:40 PM UTC)
        exdate: [],
      },
    ];

    const { result } = setupSchedule(mockRaws);

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    // There should be 2 active occurrences of slot 101 initially
    expect(result.current.parsedDraft).toHaveLength(2);

    act(() => {
      // Update occurrence 1 (1774390000)
      const success = result.current.updateDraftSlot(101, 1774390000, {
        startTime: '13:00', // Move to 13:00
        durationMinutes: 45,
      });
      expect(success).toBe(true);
    });

    // The parent slot 101 should now have 1774390000 in its exdate (leaving only 1 active weekly occurrence).
    // A new detached non-recurring slot (negative temporary ID) should be created at 13:00.
    // So there should be 2 slots in parsedDraft now:
    // - The remaining weekly occurrence (starts at 1774994800, slot 101)
    // - The detached, updated slot (starts at 13:00 local, negative temporary ID)
    expect(result.current.parsedDraft).toHaveLength(2);

    const parentOcc = result.current.parsedDraft.find((s) => s.id === 101);
    expect(parentOcc?.occurrenceUnix).toBe(1774994800); // the remaining weekly occurrence is untouched

    const baseDate = dayjs(1774390000 * 1000).format('YYYY-MM-DD');
    const expectedTime = buildDateTime(baseDate, '13:00');
    const expectedUnix = Math.floor(expectedTime.valueOf() / 1000);

    const detachedOcc = result.current.parsedDraft.find((s) => s.id < 0);
    expect(detachedOcc?.occurrenceUnix).toBe(expectedUnix); // the detached occurrence is updated to 13:00 local
    expect(detachedOcc?.durationMinutes).toBe(45);
  });

  it('restores a deleted occurrence of a recurring slot into the same row when re-added with matching time and duration', async () => {
    const { result } = setupSchedule([]);

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    act(() => {
      result.current.setSelectedDate('2026-03-24');
    });

    act(() => {
      // March 24 2026 is a Tuesday; within March this produces exactly two
      // weekly occurrences (24th and 31st) before crossing into April.
      result.current.addSlotForSelectedDate({
        startTime: '22:06',
        durationMinutes: 30,
        weeklyWithinMonth: true,
      });
    });

    expect(result.current.parsedDraft).toHaveLength(2);
    const recurringRowId = result.current.parsedDraft[0].id;
    const secondOccurrence = result.current.parsedDraft[1];

    act(() => {
      result.current.deleteDraftSlot(
        recurringRowId,
        secondOccurrence.occurrenceUnix
      );
    });

    expect(result.current.parsedDraft).toHaveLength(1);

    act(() => {
      result.current.setSelectedDate(secondOccurrence.dateKey);
    });

    act(() => {
      // Re-add the exact same time/duration that was just deleted.
      result.current.addSlotForSelectedDate({
        startTime: '22:06',
        durationMinutes: 30,
      });
    });

    // The occurrence should be restored into the ORIGINAL recurring row
    // (same id, no second row created at the same time) rather than
    // producing a duplicate row that would look like an overlap when saved.
    expect(result.current.parsedDraft).toHaveLength(2);
    expect(
      result.current.parsedDraft.every((s) => s.id === recurringRowId)
    ).toBe(true);
  });

  it('creates a new independent row instead of restoring when the re-added duration differs', async () => {
    const { result } = setupSchedule([]);

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    act(() => {
      result.current.setSelectedDate('2026-03-24');
    });

    act(() => {
      result.current.addSlotForSelectedDate({
        startTime: '22:06',
        durationMinutes: 30,
        weeklyWithinMonth: true,
      });
    });

    expect(result.current.parsedDraft).toHaveLength(2);
    const recurringRowId = result.current.parsedDraft[0].id;
    const secondOccurrence = result.current.parsedDraft[1];

    act(() => {
      result.current.deleteDraftSlot(
        recurringRowId,
        secondOccurrence.occurrenceUnix
      );
    });

    act(() => {
      result.current.setSelectedDate(secondOccurrence.dateKey);
    });

    act(() => {
      // Same start time, but a different duration than the deleted
      // occurrence — should NOT be treated as a restore.
      result.current.addSlotForSelectedDate({
        startTime: '22:06',
        durationMinutes: 45,
      });
    });

    expect(result.current.parsedDraft).toHaveLength(2);
    const idsPresent = new Set(result.current.parsedDraft.map((s) => s.id));
    expect(idsPresent.size).toBe(2);
  });

  it('correctly exdates a single occurrence of a recurring slot on delete', async () => {
    const mockRaws: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: 1774390000, // occurrence 1 (July 26, 2026 12:46:40 PM UTC)
        dtend: 1774391800,
        rrule: 'FREQ=WEEKLY;COUNT=2', // next is 1774994800
        exdate: [],
      },
    ];

    const { result } = setupSchedule(mockRaws);

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.parsedDraft).toHaveLength(2);

    act(() => {
      // Delete occurrence 1 (1774390000)
      result.current.deleteDraftSlot(101, 1774390000);
    });

    // Parent should exdate 1774390000, leaving only the second weekly occurrence (1774994800) active.
    expect(result.current.parsedDraft).toHaveLength(1);
    expect(result.current.parsedDraft[0].id).toBe(101);
    expect(result.current.parsedDraft[0].occurrenceUnix).toBe(1774994800);
  });

  it('collapses duplicate occurrences at the same start time in generateBookingSlots to one entry', async () => {
    const mockRaws: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: 1822392000, // In the future (Oct 2027)
        dtend: 1822393800,
        rrule: undefined,
        exdate: [],
      },
      {
        id: 102,
        type: 'ALLOW' as const,
        dtstart: 1822392000, // Same start time
        dtend: 1822393800,
        rrule: undefined,
        exdate: [],
      },
    ];

    const { result } = setupSchedule(mockRaws);

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    const baseDate = dayjs(1822392000 * 1000).format('YYYY-MM-DD');
    const slots = result.current.generateBookingSlots(baseDate);

    expect(slots).toHaveLength(1);
    expect(slots[0].start.getTime()).toBe(1822392000 * 1000);
  });

  it('merges isBooked status to true if any duplicate occurrence is booked', async () => {
    const mockRaws: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: 1822392000, // In the future (Oct 2027)
        dtend: 1822393800,
        rrule: undefined,
        exdate: [],
      },
      {
        id: 102,
        type: 'ALLOW' as const,
        dtstart: 1822392000, // Same start time
        dtend: 1822393800,
        rrule: undefined,
        exdate: [],
      },
      {
        id: 103,
        type: 'BOOKED' as const,
        dtstart: 1822392000,
        dtend: 1822393800,
        rrule: undefined,
        exdate: [],
      },
    ];

    const { result } = setupSchedule(mockRaws);

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    const baseDate = dayjs(1822392000 * 1000).format('YYYY-MM-DD');
    const slots = result.current.generateBookingSlots(baseDate);

    expect(slots).toHaveLength(1);
    expect(slots[0].isBooked).toBe(true);
  });
});
