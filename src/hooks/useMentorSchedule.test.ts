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
import {
  loadMonthScheduleCached,
  syncMonths,
} from '@/services/mentor-schedule/sync';

const mockLoadMonthScheduleCached = vi.mocked(loadMonthScheduleCached);

describe('useMentorSchedule', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(syncMonths).mockResolvedValue([
      { monthKey: '2026-07', outcome: { ok: true, raws: [] } },
      { monthKey: '2026-08', outcome: { ok: true, raws: [] } },
    ]);
  });

  const defaultMockRaws: RawMentorTimeslot[] = [
    {
      id: 101,
      type: 'ALLOW' as const,
      dtstart: 1785070000,
      dtend: 1785071800,
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
    expect(slot.occurrenceId).toBe('101_1785070000');
    expect(slot.id).toBe(101);
    expect(slot.occurrenceUnix).toBe(1785070000);
  });

  it('correctly updates a draft slot', async () => {
    const { result } = setupSchedule();

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    act(() => {
      const res = result.current.updateDraftSlot(101, 1785070000, {
        startTime: '13:00',
        durationMinutes: 45,
      });
      expect(res.success).toBe(true);
    });

    const baseDate = dayjs(1785070000 * 1000).format('YYYY-MM-DD');
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
      result.current.deleteDraftSlot(101, 1785070000);
    });

    expect(result.current.parsedDraft).toHaveLength(0);
  });

  it('prevents updateDraftSlot when it causes an overlap conflict', async () => {
    const baseDate = dayjs(1785070000 * 1000).format('YYYY-MM-DD');

    // Slot 102 will start at 13:45 in local timezone
    const slot102Start = buildDateTime(baseDate, '13:45');
    const slot102StartUnix = Math.floor(slot102Start.valueOf() / 1000);

    const mockRaws: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: 1785070000,
        dtend: 1785071800,
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
      const res = result.current.updateDraftSlot(101, 1785070000, {
        startTime: '13:30',
        durationMinutes: 45,
      });
      expect(res.success).toBe(false);
      expect(res.reason).toBe('OVERLAP');
    });

    // Check that slot 101 is unchanged
    const slot101 = result.current.parsedDraft.find((s) => s.id === 101);
    expect(slot101?.occurrenceUnix).toBe(1785070000);
  });

  it('correctly detaches a single occurrence of a recurring slot on update', async () => {
    const mockRaws: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: 1785070000, // occurrence 1 (July 26, 2026 12:46:40 PM UTC)
        dtend: 1785071800,
        rrule: 'FREQ=WEEKLY;COUNT=2', // next is 1785674800 (August 2, 2026 12:46:40 PM UTC)
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
      // Update occurrence 1 (1785070000)
      const res = result.current.updateDraftSlot(101, 1785070000, {
        startTime: '13:00', // Move to 13:00
        durationMinutes: 45,
      });
      expect(res.success).toBe(true);
    });

    // The parent slot 101 should now have 1785070000 in its exdate (leaving only 1 active weekly occurrence).
    // A new detached non-recurring slot (negative temporary ID) should be created at 13:00.
    // So there should be 2 slots in parsedDraft now:
    // - The remaining weekly occurrence (starts at 1785674800, slot 101)
    // - The detached, updated slot (starts at 13:00 local, negative temporary ID)
    expect(result.current.parsedDraft).toHaveLength(2);

    const parentOcc = result.current.parsedDraft.find((s) => s.id === 101);
    expect(parentOcc?.occurrenceUnix).toBe(1785674800); // the remaining weekly occurrence is untouched

    const baseDate = dayjs(1785070000 * 1000).format('YYYY-MM-DD');
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
        dtstart: 1785070000, // occurrence 1 (July 26, 2026 12:46:40 PM UTC)
        dtend: 1785071800,
        rrule: 'FREQ=WEEKLY;COUNT=2', // next is 1785674800
        exdate: [],
      },
    ];

    const { result } = setupSchedule(mockRaws);

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.parsedDraft).toHaveLength(2);

    act(() => {
      // Delete occurrence 1 (1785070000)
      result.current.deleteDraftSlot(101, 1785070000);
    });

    // Parent should exdate 1785070000, leaving only the second weekly occurrence (1785674800) active.
    expect(result.current.parsedDraft).toHaveLength(1);
    expect(result.current.parsedDraft[0].id).toBe(101);
    expect(result.current.parsedDraft[0].occurrenceUnix).toBe(1785674800);
  });

  it('regression: a recurring ALLOW row whose weekly occurrences cross a month boundary, edited on a cross-boundary occurrence, ends up in exactly one month buffer with no duplicate representation', async () => {
    // Parent slot 101 starts on July 26, 2026 (Month 7) -> 1785070000
    // Weekly recurrence count=2 -> Second occurrence is August 2, 2026 (Month 8) -> 1785674800
    const mockRawsJuly: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: 1785070000,
        dtend: 1785071800,
        rrule: 'FREQ=WEEKLY;COUNT=2',
        exdate: [],
      },
    ];

    // Mock loadMonthScheduleCached for July and also August to return mockRawsJuly (simulating parent row loaded in both months)
    mockLoadMonthScheduleCached.mockImplementation((ref) => {
      if (ref.year === 2026 && (ref.month === 7 || ref.month === 8)) {
        return {
          cached: mockRawsJuly,
          revalidate: Promise.resolve(mockRawsJuly),
        };
      }
      return {
        cached: [],
        revalidate: Promise.resolve([]),
      };
    });

    const { result } = renderHook(() =>
      useMentorSchedule({
        backend: { userId: '123', year: 2026, month: 7 },
      })
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    // There should be 2 active occurrences of slot 101 initially (one in Month 7, one in Month 8)
    expect(result.current.parsedDraft).toHaveLength(2);

    act(() => {
      // Edit the August 2 occurrence (1785674800 - Month 8)
      // Since it is edited, it should detach from the parent in July and be stored in August's buffer
      const res = result.current.updateDraftSlot(101, 1785674800, {
        startTime: '13:00', // Move to 13:00
        durationMinutes: 45,
      });
      expect(res.success).toBe(true);
    });

    // Total active occurrences should still be 2:
    // - One in July (the original parent row with exdate)
    // - One in August (the detached non-recurring slot)
    expect(result.current.parsedDraft).toHaveLength(2);

    const julyOcc = result.current.parsedDraft.find((s) => s.id === 101);
    expect(julyOcc?.occurrenceUnix).toBe(1785070000); // July occurrence remains untouched under original parent ID

    const baseDate = dayjs(1785674800 * 1000).format('YYYY-MM-DD');
    const expectedTime = buildDateTime(baseDate, '13:00');
    const expectedUnix = Math.floor(expectedTime.valueOf() / 1000);

    const augustOcc = result.current.parsedDraft.find((s) => s.id < 0);
    expect(augustOcc?.occurrenceUnix).toBe(expectedUnix); // the detached occurrence is updated to 13:00 local of August 2
    expect(augustOcc?.durationMinutes).toBe(45);

    // Verify both months are marked dirty by ensuring confirmChanges requests syncing for both (Testing Finding 1)
    const mockSyncMonths = vi.mocked(syncMonths);
    await result.current.confirmChanges();
    expect(mockSyncMonths).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ ref: expect.objectContaining({ month: 7 }) }),
        expect.objectContaining({ ref: expect.objectContaining({ month: 8 }) }),
      ])
    );
  });

  it('regression: a non-recurring ALLOW slot edited to fall in a different calendar month is correctly moved to the target month buffer', async () => {
    // Parent slot 101 starts on July 26, 2026 (Month 7) -> 1785070000 (no rrule)
    const mockRawsJuly: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: 1785070000,
        dtend: 1785071800,
        rrule: undefined,
        exdate: [],
      },
    ];

    // Mock loadMonthScheduleCached for July to return mockRawsJuly, and for August to return []
    mockLoadMonthScheduleCached.mockImplementation((ref) => {
      if (ref.year === 2026 && ref.month === 7) {
        return {
          cached: mockRawsJuly,
          revalidate: Promise.resolve(mockRawsJuly),
        };
      }
      return {
        cached: [],
        revalidate: Promise.resolve([]),
      };
    });

    const { result } = renderHook(() =>
      useMentorSchedule({
        backend: { userId: '123', year: 2026, month: 7 },
      })
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.parsedDraft).toHaveLength(1);

    // Edit occurrence of slot 101, but the base Date is set to August 2, 2026 (1785674800)
    // Under the new code, this non-recurring slot is correctly removed from July and added to August buffer.
    act(() => {
      const res = result.current.updateDraftSlot(101, 1785674800, {
        startTime: '13:00',
        durationMinutes: 45,
      });
      expect(res.success).toBe(true);
    });

    expect(result.current.parsedDraft).toHaveLength(1);
    const updatedSlot = result.current.parsedDraft[0];
    expect(updatedSlot.id).toBe(101); // remains slot 101
    expect(updatedSlot.occurrenceUnix).toBe(1785675600); // has been moved to August 2, 13:00!
    expect(updatedSlot.dateKey).toBe('2026-08-02');

    // Verify both months are marked dirty by ensuring confirmChanges requests syncing for both (Testing Finding 1)
    const mockSyncMonths = vi.mocked(syncMonths);
    await result.current.confirmChanges();
    expect(mockSyncMonths).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ ref: expect.objectContaining({ month: 7 }) }),
        expect.objectContaining({ ref: expect.objectContaining({ month: 8 }) }),
      ])
    );
  });

  it('regression: a cross-month edit/move blocks editing and throws an error if the target month is not cached/loaded', async () => {
    // Parent slot 101 starts on July 26, 2026 (Month 7) -> 1785070000
    const mockRawsJuly: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: 1785070000,
        dtend: 1785071800,
        rrule: undefined,
        exdate: [],
      },
    ];

    // Mock loadMonthScheduleCached: July returns cached data, but August returns cached: undefined
    mockLoadMonthScheduleCached.mockImplementation((ref) => {
      if (ref.year === 2026 && ref.month === 7) {
        return {
          cached: mockRawsJuly,
          revalidate: Promise.resolve(mockRawsJuly),
        };
      }
      return {
        cached: undefined, // Cache miss for August!
        revalidate: Promise.resolve([]),
      };
    });

    const { result } = renderHook(() =>
      useMentorSchedule({
        backend: { userId: '123', year: 2026, month: 7 },
      })
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.parsedDraft).toHaveLength(1);

    // Edit the slot to August 2, 2026 (1785674800)
    // Since August has a cache miss, updateDraftSlot should return TARGET_MONTH_NOT_LOADED, blocking the edit
    act(() => {
      const res = result.current.updateDraftSlot(101, 1785674800, {
        startTime: '13:00',
        durationMinutes: 45,
      });
      expect(res.success).toBe(false);
      expect(res.reason).toBe('TARGET_MONTH_NOT_LOADED');
    });

    // Ensure the slot remains in July unchanged
    expect(result.current.parsedDraft).toHaveLength(1);
    expect(result.current.parsedDraft[0].id).toBe(101);
    expect(result.current.parsedDraft[0].occurrenceUnix).toBe(1785070000);
  });

  it('regression: a cross-month edit/move blocks editing if there is an overlap conflict with existing slots in the target month', async () => {
    // Parent slot 101 starts on July 26, 2026 (Month 7) -> 1785070000
    const mockRawsJuly: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: 1785070000,
        dtend: 1785071800,
        rrule: undefined,
        exdate: [],
      },
    ];

    // August has an existing slot at 13:00 (1785675600)
    const mockRawsAugust: RawMentorTimeslot[] = [
      {
        id: 202,
        type: 'ALLOW' as const,
        dtstart: 1785675600, // August 2, 13:00 UTC
        dtend: 1785677400, // +30 mins
        rrule: undefined,
        exdate: [],
      },
    ];

    // Mock loadMonthScheduleCached
    mockLoadMonthScheduleCached.mockImplementation((ref) => {
      if (ref.year === 2026 && ref.month === 7) {
        return {
          cached: mockRawsJuly,
          revalidate: Promise.resolve(mockRawsJuly),
        };
      }
      if (ref.year === 2026 && ref.month === 8) {
        return {
          cached: mockRawsAugust,
          revalidate: Promise.resolve(mockRawsAugust),
        };
      }
      return {
        cached: [],
        revalidate: Promise.resolve([]),
      };
    });

    const { result } = renderHook(() =>
      useMentorSchedule({
        backend: { userId: '123', year: 2026, month: 7 },
      })
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    // Edit slot 101 to August 2 at 13:00 (1785674800 with patch 13:00 results in 1785675600)
    // This overlaps with August slot 202, so it should be blocked and return OVERLAP!
    act(() => {
      const res = result.current.updateDraftSlot(101, 1785674800, {
        startTime: '13:00',
        durationMinutes: 45, // overlaps with 13:00 - 13:30 of slot 202
      });
      expect(res.success).toBe(false);
      expect(res.reason).toBe('OVERLAP');
    });

    // Ensure slot 101 remains in July and is not moved or modified
    expect(result.current.parsedDraft).toHaveLength(1);
    expect(result.current.parsedDraft[0].id).toBe(101);
    expect(result.current.parsedDraft[0].occurrenceUnix).toBe(1785070000);
  });
});
