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

vi.mock('@/services/reservations', () => ({
  fetchAllReservationsForState: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/monitoring', () => ({ captureFlowFailure: vi.fn() }));

vi.mock('@/services/mentor-schedule/scheduleCache', () => ({
  clearScheduleCache: vi.fn(),
  scheduleCache: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
  },
}));

// get() defaults to returning undefined (a cache miss) so every existing
// test's mount-effect call pattern to fetchAllReservationsForState is
// unaffected unless a test explicitly configures a cache hit.
vi.mock('@/services/mentor-schedule/reservationsCache', () => ({
  getCachedReservations: vi.fn(),
  cacheReservations: vi.fn(),
  clearReservationsCache: vi.fn(),
}));

import { useMentorSchedule } from '@/hooks/useMentorSchedule';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  buildDateTime,
  RawMentorTimeslot,
} from '@/lib/profile/scheduleHelpers';
import {
  cacheReservations,
  clearReservationsCache,
  getCachedReservations,
} from '@/services/mentor-schedule/reservationsCache';
import { clearScheduleCache } from '@/services/mentor-schedule/scheduleCache';
import {
  loadMonthScheduleCached,
  loadMonthScheduleFresh,
  syncMonths,
} from '@/services/mentor-schedule/sync';
import { fetchAllReservationsForState } from '@/services/reservations';

const mockClearScheduleCache = vi.mocked(clearScheduleCache);
const mockLoadMonthScheduleCached = vi.mocked(loadMonthScheduleCached);
const mockFetchAllReservationsForState = vi.mocked(
  fetchAllReservationsForState
);
const mockGetCachedReservations = vi.mocked(getCachedReservations);
const mockCacheReservations = vi.mocked(cacheReservations);
const mockClearReservationsCache = vi.mocked(clearReservationsCache);
const mockLoadMonthScheduleFresh = vi.mocked(loadMonthScheduleFresh);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);

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

  function setupSchedule(
    mockRaws: RawMentorTimeslot[] = defaultMockRaws,
    { includeBookedDates }: { includeBookedDates?: boolean } = {}
  ) {
    mockLoadMonthScheduleCached.mockReturnValue({
      cached: mockRaws,
      revalidate: Promise.resolve(mockRaws),
    });

    return renderHook(() =>
      useMentorSchedule({
        backend: { userId: '123', year: 2026, month: 7 },
        includeBookedDates,
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

  it('regression: a recurring ALLOW row whose weekly occurrences cross a month boundary, deleted on a cross-boundary occurrence, successfully exdates the row across all monthly buffers and prevents duplicate representation', async () => {
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

    // Mock loadMonthScheduleCached for both July and August to return mockRawsJuly (simulating parent row loaded in both months)
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
      // Delete the August 2 occurrence (1785674800 - Month 8)
      // Since it is deleted, it should add 1785674800 to the exdate of row 101 in BOTH July and August buffers!
      result.current.deleteDraftSlot(101, 1785674800);
    });

    // Total active occurrences should now be 1:
    // - Only the July 26 occurrence (since August 2 is exdated on all copies of parent row 101)
    expect(result.current.parsedDraft).toHaveLength(1);

    const julyOcc = result.current.parsedDraft[0];
    expect(julyOcc.occurrenceUnix).toBe(1785070000); // Only the July 26 occurrence remains
    expect(julyOcc.id).toBe(101);

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

  it('resetChanges falls back to the last known-saved snapshot when the refetch fails', async () => {
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

    // Draft now diverges from the originally-loaded (saved) data.
    expect(result.current.parsedDraft[0].occurrenceUnix).not.toBe(1785070000);

    vi.mocked(loadMonthScheduleFresh).mockRejectedValue(
      new Error('network down')
    );

    act(() => {
      result.current.resetChanges();
    });

    // Falls back to savedByMonth (the original, pre-edit data) instead of
    // leaving the UI stuck showing the failed-to-discard draft.
    await waitFor(() => {
      expect(result.current.parsedDraft[0]?.occurrenceUnix).toBe(1785070000);
    });
    expect(result.current.parsedDraft).toHaveLength(1);
  });

  it('regression: switching accounts while viewing the same calendar month reloads the new user instead of reusing the stale buffer', async () => {
    const userARaws: RawMentorTimeslot[] = [
      {
        id: 101,
        type: 'ALLOW' as const,
        dtstart: 1785070000,
        dtend: 1785071800,
        rrule: undefined,
        exdate: [],
      },
    ];
    const userBRaws: RawMentorTimeslot[] = [
      {
        id: 201,
        type: 'ALLOW' as const,
        dtstart: 1785080000,
        dtend: 1785081800,
        rrule: undefined,
        exdate: [],
      },
    ];

    mockLoadMonthScheduleCached.mockImplementation((ref) => {
      if (ref.userId === 'userA') {
        return { cached: userARaws, revalidate: Promise.resolve(userARaws) };
      }
      if (ref.userId === 'userB') {
        return { cached: userBRaws, revalidate: Promise.resolve(userBRaws) };
      }
      return { cached: [], revalidate: Promise.resolve([]) };
    });

    const { result, rerender } = renderHook(
      (props: { backend: { userId: string; year: number; month: number } }) =>
        useMentorSchedule(props),
      { initialProps: { backend: { userId: 'userA', year: 2026, month: 7 } } }
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });
    expect(result.current.parsedDraft[0]?.id).toBe(101);

    // Same calendar month key ('2026-07'), different user — the buffer must
    // not be mistaken for already-loaded just because that month key was
    // seen before under a different account.
    rerender({ backend: { userId: 'userB', year: 2026, month: 7 } });

    await waitFor(() => {
      expect(result.current.parsedDraft[0]?.id).toBe(201);
    });
  });

  it('confirmChanges still reports a real save failure even if the account switches away before syncMonths resolves', async () => {
    mockLoadMonthScheduleCached.mockReturnValue({
      cached: defaultMockRaws,
      revalidate: Promise.resolve(defaultMockRaws),
    });

    const { result, rerender } = renderHook(
      (props: { backend: { userId: string; year: number; month: number } }) =>
        useMentorSchedule(props),
      { initialProps: { backend: { userId: 'userA', year: 2026, month: 7 } } }
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    act(() => {
      result.current.updateDraftSlot(101, 1785070000, {
        startTime: '13:00',
        durationMinutes: 45,
      });
    });

    let resolveSync!: (r: Awaited<ReturnType<typeof syncMonths>>) => void;
    vi.mocked(syncMonths).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSync = resolve;
        })
    );

    let confirmPromise!: ReturnType<typeof result.current.confirmChanges>;
    act(() => {
      confirmPromise = result.current.confirmChanges();
    });

    // Account switches away while the save is still in flight.
    rerender({ backend: { userId: 'userB', year: 2026, month: 7 } });

    resolveSync([
      {
        monthKey: '2026-07',
        outcome: { ok: false, reason: 'conflict', message: 'boom' },
      },
    ]);

    const outcome = await confirmPromise;
    // The real failure must surface — not silently reported as success just
    // because the store it would have committed into has since moved on.
    expect(outcome.ok).toBe(false);
  });

  it('resetChanges fallback uses the snapshot captured before the refetch started, immune to an intervening account switch clearing the store', async () => {
    let sawUserA = false;
    mockLoadMonthScheduleCached.mockImplementation((ref) => {
      if (ref.userId === 'userA') {
        if (sawUserA) {
          // Viewing userA again after switching away: a cache miss whose
          // revalidate never settles in this test, so the store isn't
          // synchronously repopulated before resetChanges' fallback runs.
          return {
            cached: undefined,
            revalidate: new Promise<RawMentorTimeslot[]>(() => {}),
          };
        }
        sawUserA = true;
        return {
          cached: defaultMockRaws,
          revalidate: Promise.resolve(defaultMockRaws),
        };
      }
      return { cached: [], revalidate: Promise.resolve([]) };
    });

    let rejectFresh!: (err: Error) => void;
    vi.mocked(loadMonthScheduleFresh).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectFresh = reject;
        })
    );

    const { result, rerender } = renderHook(
      (props: { backend: { userId: string; year: number; month: number } }) =>
        useMentorSchedule(props),
      { initialProps: { backend: { userId: 'userA', year: 2026, month: 7 } } }
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });
    expect(result.current.parsedDraft).toHaveLength(1);

    act(() => {
      result.current.updateDraftSlot(101, 1785070000, {
        startTime: '13:00',
        durationMinutes: 45,
      });
    });

    // Start the reset — this must capture a snapshot of userA's saved data
    // synchronously, before the refetch (and the account switches below)
    // have any chance to run.
    act(() => {
      result.current.resetChanges();
    });

    // Switch away and back to the same user while the refetch is still
    // pending — each switch clears the store via store.clearAll().
    rerender({ backend: { userId: 'userB', year: 2026, month: 7 } });
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });
    rerender({ backend: { userId: 'userA', year: 2026, month: 7 } });

    // The pending refetch now fails.
    act(() => {
      rejectFresh(new Error('network down'));
    });

    // Must fall back to the ORIGINAL saved slot (id 101), not an empty
    // array — even though the store's live state for userA was still
    // empty (cache miss, stuck revalidate) at the moment the fallback ran.
    await waitFor(() => {
      expect(result.current.parsedDraft).toHaveLength(1);
    });
    expect(result.current.parsedDraft[0]?.id).toBe(101);
  });

  describe('failed fetch vs empty schedule distinction (issue 620)', () => {
    it('sets hasError to false when fetch succeeds with empty array (genuinely no availability)', async () => {
      mockLoadMonthScheduleCached.mockReturnValue({
        cached: undefined,
        revalidate: Promise.resolve([]),
      });

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: '123', year: 2026, month: 7 },
        })
      );

      await waitFor(() => {
        expect(result.current.monthLoaded).toBe(true);
      });

      expect(result.current.hasError).toBe(false);
      expect(result.current.parsedDraft).toHaveLength(0);
    });

    it('sets hasError to true when fetch fails and there is no cache/buffer', async () => {
      mockLoadMonthScheduleCached.mockReturnValue({
        cached: undefined,
        revalidate: Promise.reject(new Error('Network error')),
      });

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: '123', year: 2026, month: 7 },
        })
      );

      await waitFor(() => {
        expect(result.current.monthLoaded).toBe(true);
      });

      expect(result.current.hasError).toBe(true);
      expect(result.current.parsedDraft).toHaveLength(0);
    });

    it('clears error and retries successfully when reload is called', async () => {
      mockLoadMonthScheduleFresh.mockReset();
      // First attempt fails
      mockLoadMonthScheduleCached.mockReturnValueOnce({
        cached: undefined,
        revalidate: Promise.reject(new Error('Network error')),
      });

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: '123', year: 2026, month: 7 },
        })
      );

      await waitFor(() => {
        expect(result.current.monthLoaded).toBe(true);
      });

      expect(result.current.hasError).toBe(true);

      // Setup next fetch to succeed with empty array
      mockLoadMonthScheduleCached.mockReturnValue({
        cached: undefined,
        revalidate: Promise.resolve([]),
      });

      // Call reload
      act(() => {
        result.current.reload();
      });

      expect(mockClearScheduleCache).toHaveBeenCalledWith(
        expect.objectContaining({ userId: '123', year: 2026, month: 7 })
      );

      await waitFor(() => {
        expect(result.current.monthLoaded).toBe(true);
      });

      expect(result.current.hasError).toBe(false);
    });
  });

  describe('reservations integration (#601)', () => {
    // Cursor pagination, the stuck-cursor guard, the end-of-month guard, and
    // fetch-failure handling live in fetchAllReservationsForState now (moved
    // to src/services/reservations/reservationService.ts — see
    // reservationService.test.ts). These tests only cover the hook's own
    // responsibility: gating the fetch on loginUserId and wiring the
    // resolved reservations into state / generateBookingSlots.
    it('does not fetch reservations when loginUserId is not provided', async () => {
      mockLoadMonthScheduleCached.mockReturnValue({
        cached: [],
        revalidate: Promise.resolve([]),
      });

      renderHook(() =>
        useMentorSchedule({
          backend: { userId: 'mentor-1', year: 2026, month: 7 },
        })
      );

      expect(mockFetchAllReservationsForState).not.toHaveBeenCalled();
    });

    it('does not fetch reservations when loginUserId is provided but does not match backend.userId', async () => {
      mockLoadMonthScheduleCached.mockReturnValue({
        cached: [],
        revalidate: Promise.resolve([]),
      });

      renderHook(() =>
        useMentorSchedule({
          backend: { userId: 'mentor-1', year: 2026, month: 7 },
          loginUserId: 'mentee-2',
        })
      );

      expect(mockFetchAllReservationsForState).not.toHaveBeenCalled();
    });

    it('fetches MENTOR_UPCOMING and MENTOR_PENDING reservations when loginUserId is provided', async () => {
      mockLoadMonthScheduleCached.mockReturnValue({
        cached: [],
        revalidate: Promise.resolve([]),
      });

      const upcoming = [
        {
          id: 'res-upcoming',
          name: 'Mentee A',
          scheduleId: 101,
          dtstart: 1785070000,
          dtend: 1785071800,
          messages: [],
          roleLine: '',
          date: '',
          time: '',
          senderUserId: 'mentee-1',
          participantUserId: 'mentor-1',
          version: 0,
        },
      ];

      const pending = [
        {
          id: 'res-pending',
          name: 'Mentee B',
          scheduleId: 102,
          dtstart: 1785080000,
          dtend: 1785081800,
          messages: [],
          roleLine: '',
          date: '',
          time: '',
          senderUserId: 'mentee-2',
          participantUserId: 'mentor-1',
          version: 0,
        },
      ];

      mockFetchAllReservationsForState.mockImplementation(
        async (_userId, state) =>
          state === 'MENTOR_UPCOMING' ? upcoming : pending
      );

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: 'mentor-1', year: 2026, month: 7 },
          loginUserId: 'mentor-1',
        })
      );

      await waitFor(() => {
        expect(result.current.reservations).toHaveLength(2);
      });

      expect(mockFetchAllReservationsForState).toHaveBeenCalledWith(
        'mentor-1',
        'MENTOR_UPCOMING',
        expect.any(Number)
      );
      expect(mockFetchAllReservationsForState).toHaveBeenCalledWith(
        'mentor-1',
        'MENTOR_PENDING',
        expect.any(Number)
      );

      const resUpcoming = result.current.reservations.find(
        (r) => r.id === 'res-upcoming'
      );
      const resPending = result.current.reservations.find(
        (r) => r.id === 'res-pending'
      );
      expect(resUpcoming).toBeDefined();
      expect(resPending).toBeDefined();
    });

    it('serves reservations from cache without calling fetchAllReservationsForState on a cache hit', async () => {
      mockLoadMonthScheduleCached.mockReturnValue({
        cached: [],
        revalidate: Promise.resolve([]),
      });

      const cachedUpcoming = [
        {
          id: 'res-cached-upcoming',
          name: 'Mentee A',
          scheduleId: 101,
          dtstart: 1785070000,
          dtend: 1785071800,
          messages: [],
          roleLine: '',
          date: '',
          time: '',
          senderUserId: 'mentee-1',
          participantUserId: 'mentor-1',
          version: 0,
        },
      ];
      const cachedPending = [
        {
          id: 'res-cached-pending',
          name: 'Mentee B',
          scheduleId: 102,
          dtstart: 1785080000,
          dtend: 1785081800,
          messages: [],
          roleLine: '',
          date: '',
          time: '',
          senderUserId: 'mentee-2',
          participantUserId: 'mentor-1',
          version: 0,
        },
      ];

      // *Once (rather than a lasting mockImplementation) so this cache hit
      // applies only to this test's two calls and the mock reverts to its
      // default "cache miss" (undefined) for every later test.
      mockGetCachedReservations
        .mockReturnValueOnce(cachedUpcoming)
        .mockReturnValueOnce(cachedPending);
      // Earlier tests' calls to fetchAllReservationsForState linger in its
      // mock call history (vi.restoreAllMocks() in beforeEach clears
      // implementations but not call history) - clear it so ".not
      // .toHaveBeenCalled()" below reflects only this test's render.
      mockFetchAllReservationsForState.mockClear();

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: 'mentor-1', year: 2026, month: 7 },
          loginUserId: 'mentor-1',
        })
      );

      await waitFor(() => {
        expect(result.current.reservations).toHaveLength(2);
      });

      expect(mockFetchAllReservationsForState).not.toHaveBeenCalled();
      expect(
        result.current.reservations.find((r) => r.id === 'res-cached-upcoming')
      ).toBeDefined();
      expect(
        result.current.reservations.find((r) => r.id === 'res-cached-pending')
      ).toBeDefined();
    });

    it('primes the reservations cache after a network fetch on a cache miss', async () => {
      mockLoadMonthScheduleCached.mockReturnValue({
        cached: [],
        revalidate: Promise.resolve([]),
      });
      mockFetchAllReservationsForState.mockResolvedValue([]);

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: 'mentor-1', year: 2026, month: 7 },
          loginUserId: 'mentor-1',
        })
      );

      await waitFor(() => {
        expect(result.current.reservationsLoaded).toBe(true);
      });

      expect(mockCacheReservations).toHaveBeenCalledWith(
        'mentor-1',
        'MENTOR_UPCOMING',
        expect.any(Number),
        []
      );
      expect(mockCacheReservations).toHaveBeenCalledWith(
        'mentor-1',
        'MENTOR_PENDING',
        expect.any(Number),
        []
      );
    });

    it('reload() bypasses the reservations cache, wipes it, then re-primes it with the fresh result', async () => {
      mockLoadMonthScheduleCached.mockReturnValue({
        cached: [],
        revalidate: Promise.resolve([]),
      });
      mockFetchAllReservationsForState.mockResolvedValue([]);

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: 'mentor-1', year: 2026, month: 7 },
          loginUserId: 'mentor-1',
        })
      );

      await waitFor(() => {
        expect(result.current.reservationsLoaded).toBe(true);
      });

      mockFetchAllReservationsForState.mockClear();
      mockCacheReservations.mockClear();
      mockClearReservationsCache.mockClear();

      await act(async () => {
        await result.current.reload();
      });

      expect(mockFetchAllReservationsForState).toHaveBeenCalledWith(
        'mentor-1',
        'MENTOR_UPCOMING',
        expect.any(Number)
      );
      expect(mockFetchAllReservationsForState).toHaveBeenCalledWith(
        'mentor-1',
        'MENTOR_PENDING',
        expect.any(Number)
      );
      // A mutated reservation can be embedded in every OTHER cached month's
      // entry too (each covers "now through that month's end"), not just
      // the currently-viewed one, so reload must wipe everything rather
      // than re-prime only the current month's two keys.
      expect(mockClearReservationsCache).toHaveBeenCalled();
      expect(mockCacheReservations).toHaveBeenCalledWith(
        'mentor-1',
        'MENTOR_UPCOMING',
        expect.any(Number),
        []
      );
      expect(mockCacheReservations).toHaveBeenCalledWith(
        'mentor-1',
        'MENTOR_PENDING',
        expect.any(Number),
        []
      );
      // Order matters: the wipe must happen before the re-prime (or the
      // fresh values written for this month would themselves get erased)
      // and before the fetch even starts (so a failed/abandoned fetch still
      // leaves the cache cleared rather than stale).
      const clearOrder = mockClearReservationsCache.mock.invocationCallOrder[0];
      const firstFetchOrder =
        mockFetchAllReservationsForState.mock.invocationCallOrder[0];
      const firstCacheOrder = mockCacheReservations.mock.invocationCallOrder[0];
      expect(clearOrder).toBeLessThan(firstFetchOrder);
      expect(clearOrder).toBeLessThan(firstCacheOrder);
    });

    it('reload() clears the reservations cache even when the refetch fails', async () => {
      mockLoadMonthScheduleCached.mockReturnValue({
        cached: [],
        revalidate: Promise.resolve([]),
      });
      mockFetchAllReservationsForState.mockResolvedValue([]);

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: 'mentor-1', year: 2026, month: 7 },
          loginUserId: 'mentor-1',
        })
      );

      await waitFor(() => {
        expect(result.current.reservationsLoaded).toBe(true);
      });

      mockClearReservationsCache.mockClear();
      mockCacheReservations.mockClear();
      // A mutation (e.g. accept/reject) is what would normally trigger this
      // reload; the network fetch it kicks off then fails.
      mockFetchAllReservationsForState.mockRejectedValue(
        new Error('network down')
      );

      await act(async () => {
        await result.current.reload();
      });

      // The cache must still be wiped - a failed reload leaves stale
      // pre-mutation data in the cache otherwise, for up to the TTL.
      expect(mockClearReservationsCache).toHaveBeenCalled();
      expect(mockCacheReservations).not.toHaveBeenCalled();
    });

    it('clears the reservations cache when the backend user switches', async () => {
      mockLoadMonthScheduleCached.mockReturnValue({
        cached: [],
        revalidate: Promise.resolve([]),
      });
      mockFetchAllReservationsForState.mockResolvedValue([]);

      const { result, rerender } = renderHook(
        (props: { backend: { userId: string; year: number; month: number } }) =>
          useMentorSchedule({ ...props, loginUserId: props.backend.userId }),
        { initialProps: { backend: { userId: 'userA', year: 2026, month: 7 } } }
      );

      await waitFor(() => {
        expect(result.current.reservationsLoaded).toBe(true);
      });

      // Earlier tests' account-switch calls linger in this mock's call
      // history (vi.restoreAllMocks() clears implementations, not history).
      mockClearReservationsCache.mockClear();
      expect(mockClearReservationsCache).not.toHaveBeenCalled();

      rerender({ backend: { userId: 'userB', year: 2026, month: 7 } });

      await waitFor(() => {
        expect(mockClearReservationsCache).toHaveBeenCalled();
      });
    });

    it('correctly matches reservations to booking slots and populates menteeName', async () => {
      const mockRaws: RawMentorTimeslot[] = [
        {
          id: 101,
          type: 'ALLOW' as const,
          dtstart: 1790426800,
          dtend: 1790428600,
          rrule: undefined,
          exdate: [],
        },
      ];

      mockLoadMonthScheduleCached.mockReturnValue({
        cached: mockRaws,
        revalidate: Promise.resolve(mockRaws),
      });

      mockFetchAllReservationsForState.mockImplementation(
        async (_userId, state) =>
          state === 'MENTOR_UPCOMING'
            ? [
                {
                  id: 'res-1',
                  name: 'Alice',
                  scheduleId: 101,
                  dtstart: 1790426800,
                  dtend: 1790428600,
                  messages: [],
                  roleLine: '',
                  date: '',
                  time: '',
                  senderUserId: 'mentee-1',
                  participantUserId: 'mentor-1',
                  version: 0,
                },
              ]
            : []
      );

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: 'mentor-1', year: 2026, month: 9 },
          loginUserId: 'mentor-1',
        })
      );

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      act(() => {
        result.current.setSelectedDate('2026-09-26');
      });
      const slots = result.current.slotsSnapshot.slots;
      expect(slots).toHaveLength(1);
      expect(slots[0].menteeName).toBe('Alice');
    });

    it('reports reservationsLoaded=false while the reservations fetch is in flight, independent of the schedule fetch', async () => {
      // Regression test for the profile-page bug where clicking a PENDING
      // booked slot right after this hook remounts (e.g. navigating back to
      // the profile page) could redirect instead of opening the quick-reply
      // dialog: the schedule fetch (which drives slot.status) can resolve
      // before this reservations fetch (which drives slot.reservation)
      // does, so a caller must gate on reservationsLoaded specifically
      // rather than assuming monthLoaded covers both.
      mockLoadMonthScheduleCached.mockReturnValue({
        cached: defaultMockRaws,
        revalidate: Promise.resolve(defaultMockRaws),
      });

      const resolveFetchers: Array<(value: []) => void> = [];
      mockFetchAllReservationsForState.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFetchers.push(resolve);
          })
      );

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: '123', year: 2026, month: 7 },
          loginUserId: '123',
        })
      );

      // Schedule fetch is cached and resolves synchronously, but the
      // reservations fetch is still pending.
      await waitFor(() => {
        expect(result.current.monthLoaded).toBe(true);
      });
      expect(result.current.reservationsLoaded).toBe(false);

      await waitFor(() => {
        expect(resolveFetchers).toHaveLength(2);
      });

      await act(async () => {
        resolveFetchers.forEach((resolve) => resolve([]));
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.reservationsLoaded).toBe(true);
      });
    });

    it('reports the failure and leaves reservationsLoaded false when the reservations fetch throws unexpectedly', async () => {
      // fetchAllReservationsForState itself never rejects in production (it
      // swallows its own errors, see reservationService.ts), but this
      // exercises the hook's own defense-in-depth catch for anything else
      // that could throw. reservationsLoaded must stay false here — it's
      // only ever set true on the success path, deliberately not in a
      // `finally` (which would run on this failure too and mark the flag
      // loaded despite `reservations` never actually being written).
      mockLoadMonthScheduleCached.mockReturnValue({
        cached: defaultMockRaws,
        revalidate: Promise.resolve(defaultMockRaws),
      });
      mockFetchAllReservationsForState.mockRejectedValue(new Error('boom'));

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: '123', year: 2026, month: 7 },
          loginUserId: '123',
        })
      );

      await waitFor(() => {
        expect(mockCaptureFlowFailure).toHaveBeenCalledWith(
          expect.objectContaining({
            flow: 'mentor_schedule_fetch_reservations',
            step: 'fetch_all_reservations',
            message: 'boom',
          })
        );
      });

      expect(result.current.reservationsLoaded).toBe(false);
    });
  });

  describe('reload (#604)', () => {
    it('successfully reloads reservations and schedule and updates state/store', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(
        new Date('2026-07-01T00:00:00Z').getTime()
      );

      mockLoadMonthScheduleCached.mockReset();

      // Set up fresh mock values for reload
      const reloadedRaws: RawMentorTimeslot[] = [
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
          type: 'BOOKED' as const,
          dtstart: 1785070000,
          dtend: 1785071800,
          rrule: undefined,
          exdate: [],
        },
      ];

      let cachedCalls = 0;
      mockLoadMonthScheduleCached.mockImplementation(() => {
        cachedCalls++;
        if (cachedCalls === 1) {
          return {
            cached: defaultMockRaws,
            revalidate: Promise.resolve(defaultMockRaws),
          };
        } else {
          return {
            cached: undefined,
            revalidate: Promise.resolve(reloadedRaws),
          };
        }
      });

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: '123', year: 2026, month: 7 },
          loginUserId: '123',
        })
      );

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      const reloadedReservations = [
        {
          id: 'res-reload',
          name: 'Reloaded Mentee',
          scheduleId: 102,
          dtstart: 1785070000,
          dtend: 1785071800,
          messages: [],
          roleLine: '',
          date: '',
          time: '',
          senderUserId: 'mentee-reload',
          participantUserId: '123',
          version: 1,
        },
      ];

      mockFetchAllReservationsForState.mockImplementation(
        async (_userId, state) =>
          state === 'MENTOR_UPCOMING' ? reloadedReservations : []
      );

      // Trigger reload
      await act(async () => {
        await result.current.reload?.();
      });

      // Verify reservations are refreshed
      expect(result.current.reservations).toHaveLength(1);
      expect(result.current.reservations[0].id).toBe('res-reload');

      // Verify loadMonthScheduleCached was called
      expect(mockLoadMonthScheduleCached).toHaveBeenCalledTimes(2);
      expect(mockLoadMonthScheduleCached).toHaveBeenLastCalledWith({
        userId: '123',
        year: 2026,
        month: 7,
      });

      // Verify calendar slots are updated with new mentee name
      act(() => {
        result.current.setSelectedDate('2026-07-26');
      });
      const slots = result.current.slotsSnapshot.slots;
      expect(slots).toHaveLength(1);
      expect(slots[0].isBooked).toBe(true);
      expect(slots[0].status).toBe('BOOKED');
      expect(slots[0].menteeName).toBe('Reloaded Mentee');
    });

    it('swallows errors from a failed reload instead of throwing or leaving state stuck', async () => {
      // fetchAllReservationsForState/loadMonthScheduleFresh are vi.fn()
      // mocks from a vi.mock() factory, not vi.spyOn() spies, so the outer
      // beforeEach's vi.restoreAllMocks() does not reset the implementation
      // a prior test left behind. Reset explicitly so this test's initial
      // mount fetch isn't polluted by the previous test's resolved data.
      mockFetchAllReservationsForState.mockReset().mockResolvedValue([]);
      mockLoadMonthScheduleFresh.mockReset();
      mockLoadMonthScheduleCached.mockReset();

      let cachedCalls = 0;
      mockLoadMonthScheduleCached.mockImplementation(() => {
        cachedCalls++;
        if (cachedCalls === 1) {
          return {
            cached: defaultMockRaws,
            revalidate: Promise.resolve(defaultMockRaws),
          };
        } else {
          return {
            cached: defaultMockRaws,
            revalidate: Promise.reject(new Error('schedule refetch failed')),
          };
        }
      });

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: '123', year: 2026, month: 7 },
          loginUserId: '123',
        })
      );

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      mockFetchAllReservationsForState.mockRejectedValue(
        new Error('reservations refetch failed')
      );

      // Neither reloadReservations nor reloadSchedule rethrow: reload() must
      // resolve cleanly rather than reject or crash the caller.
      await expect(
        act(async () => {
          await result.current.reload?.();
        })
      ).resolves.toBeUndefined();

      // State is left as-is (pre-failure) rather than cleared or corrupted.
      expect(result.current.reservations).toEqual([]);
      expect(result.current.parsedDraft).toHaveLength(1);
    });

    it('does not apply reloaded schedule or reservations if the active user changes mid-flight', async () => {
      mockFetchAllReservationsForState.mockReset().mockResolvedValue([]);
      mockLoadMonthScheduleFresh.mockReset();
      mockLoadMonthScheduleCached.mockReset();

      // Prepare fresh reload values
      const reloadedRaws: RawMentorTimeslot[] = [
        {
          id: 101,
          type: 'ALLOW',
          dtstart: 1785075000,
          dtend: 1785076800,
          rrule: undefined,
          exdate: [],
        },
      ];

      // Delay the fresh schedule refetch slightly so we can trigger an account switch
      let resolveScheduleFetch: (raws: RawMentorTimeslot[]) => void = () => {};
      const schedulePromise = new Promise<RawMentorTimeslot[]>((resolve) => {
        resolveScheduleFetch = resolve;
      });

      let cachedCalls123 = 0;
      mockLoadMonthScheduleCached.mockImplementation((ref) => {
        if (ref.userId === '123') {
          cachedCalls123++;
          if (cachedCalls123 === 1) {
            return {
              cached: defaultMockRaws,
              revalidate: Promise.resolve(defaultMockRaws),
            };
          } else {
            return {
              cached: undefined,
              revalidate: schedulePromise,
            };
          }
        } else {
          return {
            cached: undefined,
            revalidate: Promise.resolve([]),
          };
        }
      });

      const { result, rerender } = renderHook(
        ({ userId }) =>
          useMentorSchedule({
            backend: { userId, year: 2026, month: 7 },
            loginUserId: userId,
          }),
        { initialProps: { userId: '123' } }
      );

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      const reloadPromise = result.current.reload?.();

      // Change user mid-flight (account switch)
      act(() => {
        rerender({ userId: '456' });
      });

      // Resolve the fetch for the OLD user ('123')
      resolveScheduleFetch(reloadedRaws);

      await act(async () => {
        await reloadPromise;
      });

      // Ensure the old user's reloaded data is NOT applied
      expect(result.current.reservations).toEqual([]);
      // Should not contain 1785075000 (old user's reloaded schedule)
      const hasOldReloaded = result.current.parsedDraft.some(
        (d) => d.start.getTime() === 1785075000 * 1000
      );
      expect(hasOldReloaded).toBe(false);
    });

    it('does not discard unsaved draft edits when reloading schedule', async () => {
      mockFetchAllReservationsForState.mockReset().mockResolvedValue([]);
      mockLoadMonthScheduleFresh.mockReset();
      mockLoadMonthScheduleCached.mockReset();

      // Mock the loaded raws
      const reloadedRaws: RawMentorTimeslot[] = [
        {
          id: 101,
          type: 'ALLOW',
          dtstart: 1785075000,
          dtend: 1785076800,
          rrule: undefined,
          exdate: [],
        },
      ];

      let cachedCalls = 0;
      mockLoadMonthScheduleCached.mockImplementation(() => {
        cachedCalls++;
        if (cachedCalls === 1) {
          return {
            cached: defaultMockRaws,
            revalidate: Promise.resolve(defaultMockRaws),
          };
        } else {
          return {
            cached: undefined,
            revalidate: Promise.resolve(reloadedRaws),
          };
        }
      });

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: '123', year: 2026, month: 7 },
          loginUserId: '123',
        })
      );

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      // Trigger an edit to make the month dirty
      act(() => {
        result.current.updateDraftSlot(101, 1785070000, { startTime: '13:00' });
      });

      const draftBeforeReload = result.current.parsedDraft;

      // Trigger reload
      await act(async () => {
        await result.current.reload?.();
      });

      // Verify the dirty draft is preserved and not discarded or overwritten
      expect(result.current.parsedDraft).toEqual(draftBeforeReload);
    });

    it('does not apply state update or trigger errors if the component unmounts mid-flight of reload', async () => {
      mockFetchAllReservationsForState.mockReset();
      mockLoadMonthScheduleFresh.mockReset();
      mockLoadMonthScheduleCached.mockReset();

      // We need a slow promise for reservations and schedule reload
      let resolveReservations: (
        val: Awaited<ReturnType<typeof fetchAllReservationsForState>>
      ) => void = () => {};
      const resPromise = new Promise<
        Awaited<ReturnType<typeof fetchAllReservationsForState>>
      >((resolve) => {
        resolveReservations = resolve;
      });
      mockFetchAllReservationsForState.mockReturnValue(resPromise);

      let resolveSchedule: (val: RawMentorTimeslot[]) => void = () => {};
      const schedulePromise = new Promise<RawMentorTimeslot[]>((resolve) => {
        resolveSchedule = resolve;
      });

      let cachedCalls = 0;
      mockLoadMonthScheduleCached.mockImplementation(() => {
        cachedCalls++;
        if (cachedCalls === 1) {
          return {
            cached: defaultMockRaws,
            revalidate: Promise.resolve(defaultMockRaws),
          };
        } else {
          return {
            cached: undefined,
            revalidate: schedulePromise,
          };
        }
      });

      const { result, unmount } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: '123', year: 2026, month: 7 },
          loginUserId: '123',
        })
      );

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      const reloadPromise = act(async () => {
        await result.current.reload?.();
      });

      // Unmount the component while reload is in-flight
      unmount();

      // Resolve the fetches
      resolveReservations([]);
      resolveSchedule([]);

      await reloadPromise;

      // Ensure no state update warning occurred and state is stable
      expect(result.current.reservations).toEqual([]);
    });

    it('does not capture flow failure if reload schedule fails after account has already switched or component unmounted', async () => {
      mockFetchAllReservationsForState.mockReset().mockResolvedValue([]);
      mockLoadMonthScheduleFresh.mockReset();
      mockCaptureFlowFailure.mockReset();
      mockLoadMonthScheduleCached.mockReset();

      // Slow rejected promise
      let rejectSchedule: (err: Error) => void = () => {};
      const schedulePromise = new Promise<RawMentorTimeslot[]>((_, reject) => {
        rejectSchedule = reject;
      });

      let cachedCalls123 = 0;
      mockLoadMonthScheduleCached.mockImplementation((ref) => {
        if (ref.userId === '123') {
          cachedCalls123++;
          if (cachedCalls123 === 1) {
            return {
              cached: defaultMockRaws,
              revalidate: Promise.resolve(defaultMockRaws),
            };
          } else {
            return {
              cached: undefined,
              revalidate: schedulePromise,
            };
          }
        } else {
          return {
            cached: undefined,
            revalidate: Promise.resolve([]),
          };
        }
      });

      const { result, rerender } = renderHook(
        ({ userId }) =>
          useMentorSchedule({
            backend: { userId, year: 2026, month: 7 },
            loginUserId: userId,
          }),
        { initialProps: { userId: '123' } }
      );

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      const reloadPromise = result.current.reload?.();

      // Switch user mid-flight
      act(() => {
        rerender({ userId: '456' });
      });

      // Reject the schedule fetch for the OLD user
      rejectSchedule(new Error('old user fetch failed'));

      await act(async () => {
        await reloadPromise;
      });

      // Verify that captureFlowFailure was NOT called because the user has switched
      expect(mockCaptureFlowFailure).not.toHaveBeenCalled();
    });

    it('does not apply reloaded reservations if the calendar month changes mid-flight', async () => {
      mockFetchAllReservationsForState.mockReset().mockResolvedValue([]);
      mockLoadMonthScheduleFresh.mockReset().mockResolvedValue([]);

      mockLoadMonthScheduleCached.mockReturnValue({
        cached: defaultMockRaws,
        revalidate: Promise.resolve(defaultMockRaws),
      });

      const { result, rerender } = renderHook(
        ({ month }) =>
          useMentorSchedule({
            backend: { userId: '123', year: 2026, month },
            loginUserId: '123',
          }),
        { initialProps: { month: 7 } }
      );

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      // Prepare reload reservations that are slow
      let resolveReservations: (
        val: Awaited<ReturnType<typeof fetchAllReservationsForState>>
      ) => void = () => {};
      const resPromise = new Promise<
        Awaited<ReturnType<typeof fetchAllReservationsForState>>
      >((resolve) => {
        resolveReservations = resolve;
      });

      mockFetchAllReservationsForState.mockImplementation(
        async (userId, state, endOfMonthUnix) => {
          // Return slow promise for month 7, resolve immediately to [] for month 8
          if (endOfMonthUnix < 1786000000) {
            return resPromise;
          }
          return [];
        }
      );

      const reloadPromise = result.current.reload?.();

      // Switch month mid-flight (from 7 to 8)
      act(() => {
        rerender({ month: 8 });
      });

      // Resolve reservations for month 7
      resolveReservations([
        {
          id: 'res-stale-month',
          name: 'Stale Month Mentee',
          scheduleId: 101,
          dtstart: 1785070000,
          dtend: 1785071800,
          messages: [],
          roleLine: '',
          date: '',
          time: '',
          senderUserId: 'mentee-stale',
          participantUserId: '123',
          version: 1,
        },
      ]);

      await act(async () => {
        await reloadPromise;
      });

      // Verify that the stale month's reservations were NOT applied
      expect(result.current.reservations).toEqual([]);
    });

    it('prevents race conditions with isStale when backend.month changes mid-flight during fetch', async () => {
      mockFetchAllReservationsForState.mockReset().mockResolvedValue([]);
      mockLoadMonthScheduleFresh.mockReset();
      mockLoadMonthScheduleCached.mockReset();

      mockLoadMonthScheduleCached.mockReturnValue({
        cached: defaultMockRaws,
        revalidate: Promise.resolve(defaultMockRaws),
      });

      const { result, rerender } = renderHook(
        ({ month }) =>
          useMentorSchedule({
            backend: { userId: '123', year: 2026, month },
            loginUserId: '123',
          }),
        { initialProps: { month: 7 } }
      );

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      // Set up a slow pending revalidate promise for the reload/refetch
      let resolveSchedule: (raws: RawMentorTimeslot[]) => void = () => {};
      const schedulePromise = new Promise<RawMentorTimeslot[]>((resolve) => {
        resolveSchedule = resolve;
      });

      mockLoadMonthScheduleCached.mockImplementation((ref) => {
        if (ref.month === 7) {
          return {
            cached: undefined,
            revalidate: schedulePromise,
          };
        } else {
          return {
            cached: undefined,
            revalidate: Promise.resolve([]),
          };
        }
      });

      // Start reload (or fetch) for month 7
      const reloadPromise = result.current.reload?.();

      // Change month to 8 mid-flight
      act(() => {
        rerender({ month: 8 });
      });

      // Now resolve the schedule promise for month 7
      const month7Raws: RawMentorTimeslot[] = [
        {
          id: 101,
          type: 'ALLOW',
          dtstart: 1785070000,
          dtend: 1785071800,
          rrule: undefined,
          exdate: [],
        },
      ];
      resolveSchedule(month7Raws);

      await act(async () => {
        await reloadPromise;
      });

      // Since month changed to 8, the resolved month 7 raws should NOT be applied
      // to month 8. There should be no slots for August in the draft.
      const hasAugustSlots = result.current.parsedDraft.some((slot) =>
        slot.dateKey.startsWith('2026-08')
      );
      expect(hasAugustSlots).toBe(false);
    });
  });
});
