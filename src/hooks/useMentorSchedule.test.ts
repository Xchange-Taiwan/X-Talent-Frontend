process.env.TZ = 'UTC';

import { act, renderHook, waitFor } from '@testing-library/react';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Only the raw network read is mocked. Caching, in-flight de-duplication,
// cancellation and "whose response is allowed to win" all run for real
// through MentorScheduleReadModel, so these tests exercise the hook's public
// contract instead of its internal call order.
vi.mock('@/services/mentor-schedule/sync', () => ({
  loadMonthSchedule: vi.fn(),
  loadMonthScheduleFresh: vi.fn(),
  prefetchMonthSchedule: vi.fn(),
  syncMonths: vi.fn(),
}));

vi.mock('@/services/reservations', () => ({
  fetchAllReservationsForState: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/monitoring', () => ({ captureFlowFailure: vi.fn() }));

import { useMentorSchedule } from '@/hooks/useMentorSchedule';
import {
  type ScheduleReadKey,
  scheduleReadModel,
} from '@/lib/mentor-schedule/scheduleReadModel';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  buildDateTime,
  RawMentorTimeslot,
} from '@/lib/profile/scheduleHelpers';
import {
  MENTOR_SCHEDULE_RESERVATIONS_TTL_MS,
  type ReservationReadKey,
  reservationReadModel,
} from '@/lib/reservation/reservationReadModel';
import {
  loadMonthSchedule,
  loadMonthScheduleFresh,
  syncMonths,
} from '@/services/mentor-schedule/sync';
import { fetchAllReservationsForState } from '@/services/reservations';

const mockLoadMonthSchedule = vi.mocked(loadMonthSchedule);
const mockFetchAllReservationsForState = vi.mocked(
  fetchAllReservationsForState
);
const mockLoadMonthScheduleFresh = vi.mocked(loadMonthScheduleFresh);
const mockCaptureFlowFailure = vi.mocked(captureFlowFailure);

function scheduleKey(
  month: number,
  userId = '123',
  year = 2026
): ScheduleReadKey {
  return { userId, year, month };
}

/** A month request the test resolves or rejects by hand. */
function deferredMonth(): {
  promise: Promise<RawMentorTimeslot[]>;
  resolve: (raws: RawMentorTimeslot[]) => void;
  reject: (err: Error) => void;
} {
  let resolve: (raws: RawMentorTimeslot[]) => void = () => {};
  let reject: (err: Error) => void = () => {};
  const promise = new Promise<RawMentorTimeslot[]>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve: (raws) => resolve(raws),
    reject: (err) => reject(err),
  };
}

// The reservation-fetching tests below exercise the real
// reservationReadModel (not a mock) so they verify actual cache/TTL
// behaviour rather than just "was this function called" - clear() resets
// its module-level cache between tests, mirroring reservationReadModel's
// own test file.
function reservationKey(
  state: 'MENTOR_UPCOMING' | 'MENTOR_PENDING',
  endOfMonthUnix: number,
  userId = '123'
): ReservationReadKey {
  return { userId, state, endOfMonthUnix };
}

function computeEndOfMonthUnix(year: number, month: number): number {
  return dayjs(new Date(year, month - 1, 1))
    .endOf('month')
    .unix();
}

describe('useMentorSchedule', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    reservationReadModel.clear();
    scheduleReadModel.clear();
    // vi.restoreAllMocks() does not reset call history for a vi.fn() created
    // inside a vi.mock() factory (only for vi.spyOn() spies) - now that the
    // reader/editor gating tests above also grant an editor (loginUserId
    // matching backend.userId), their mount-effect reservation fetches would
    // otherwise leak into every later test's call-count assertions.
    mockFetchAllReservationsForState.mockClear();
    mockLoadMonthSchedule.mockClear();
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
    mockLoadMonthSchedule.mockResolvedValue(mockRaws);

    // loginUserId matches backend.userId so the hook grants `editor` - most
    // of this file's tests exercise the mentor's own draft-mutation flow.
    return renderHook(() =>
      useMentorSchedule({
        backend: { userId: '123', year: 2026, month: 7 },
        loginUserId: '123',
        includeBookedDates,
      })
    );
  }

  describe('reader/editor gating', () => {
    it('grants only a reader, with editor null, when loginUserId does not match backend.userId (mentee/visitor)', async () => {
      mockLoadMonthSchedule.mockResolvedValue(defaultMockRaws);

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: '123', year: 2026, month: 7 },
          loginUserId: 'someone-else',
        })
      );

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      expect(result.current.editor).toBeNull();
      expect(result.current.reader.slotsSnapshot).toBeDefined();
      expect(result.current.reader.allowedDates).toBeDefined();
    });

    it('grants both a reader and an editor when loginUserId matches backend.userId (the mentor managing their own schedule)', async () => {
      mockLoadMonthSchedule.mockResolvedValue(defaultMockRaws);

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: '123', year: 2026, month: 7 },
          loginUserId: '123',
        })
      );

      await waitFor(() => {
        expect(result.current.loaded).toBe(true);
      });

      expect(result.current.editor).not.toBeNull();
      expect(result.current.editor?.addSlotForSelectedDate).toBeInstanceOf(
        Function
      );
    });

    it('a mentee/visitor still gets the mentor’s bookable slots through the reader alone', async () => {
      // defaultMockRaws sits on 2026-07-26; freeze "now" before it so the
      // occurrence isn't filtered out as already past.
      vi.spyOn(Date, 'now').mockReturnValue(
        new Date('2026-07-01T00:00:00Z').getTime()
      );
      mockLoadMonthSchedule.mockResolvedValue(defaultMockRaws);

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: '123', year: 2026, month: 7 },
          loginUserId: 'mentee-9',
        })
      );

      await waitFor(() => {
        expect(result.current.reader.slotsSnapshot.monthLoaded).toBe(true);
      });

      act(() => {
        result.current.reader.setSelectedDate('2026-07-26');
      });

      expect(result.current.reader.slotsSnapshot.slots).toHaveLength(1);
      expect(result.current.reader.allowedDates).toContain('2026-07-26');
      expect(result.current.reader.hasError).toBe(false);
      // No reservations read is issued for someone else's calendar, so this
      // side of the hook never blocks on one.
      expect(mockFetchAllReservationsForState).not.toHaveBeenCalled();
      expect(result.current.reader.slotsSnapshot.reservationsLoaded).toBe(true);
    });
  });

  describe('month reads (X-Tracker #669)', () => {
    it('serves a month it has already loaded from cache instead of re-requesting it', async () => {
      mockLoadMonthSchedule.mockImplementation(async (ref) =>
        ref.month === 7 ? defaultMockRaws : []
      );

      const { result, rerender } = renderHook(
        ({ month }) =>
          useMentorSchedule({
            backend: { userId: '123', year: 2026, month },
            loginUserId: '123',
          }),
        { initialProps: { month: 7 } }
      );

      await waitFor(() => expect(result.current.loaded).toBe(true));
      expect(mockLoadMonthSchedule).toHaveBeenCalledTimes(1);

      // Swipe forward, then back to the month already read.
      rerender({ month: 8 });
      await waitFor(() =>
        expect(mockLoadMonthSchedule).toHaveBeenCalledTimes(2)
      );

      rerender({ month: 7 });
      await waitFor(() =>
        expect(result.current.reader.slotsSnapshot.monthLoaded).toBe(true)
      );

      expect(mockLoadMonthSchedule).toHaveBeenCalledTimes(2);
      expect(result.current.parsedDraft).toHaveLength(1);
    });

    it('unmounting mid-request neither updates state nor leaves a rejection unhandled', async () => {
      const inFlight = deferredMonth();
      mockLoadMonthSchedule.mockReturnValue(inFlight.promise);

      const { result, unmount } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: '123', year: 2026, month: 7 },
          loginUserId: '123',
        })
      );

      expect(result.current.reader.slotsSnapshot.monthLoaded).toBe(false);

      unmount();
      inFlight.reject(new Error('component already gone'));

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      // The abandoned response is neither applied nor cached.
      expect(result.current.loaded).toBe(false);
      expect(scheduleReadModel.get(scheduleKey(7))).toBeUndefined();
    });

    it('shows what the backend returned after a save followed by a reload', async () => {
      mockLoadMonthSchedule.mockResolvedValue(defaultMockRaws);

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: '123', year: 2026, month: 7 },
          loginUserId: '123',
        })
      );

      await waitFor(() => expect(result.current.loaded).toBe(true));

      act(() => {
        result.current.editor!.updateDraftSlot(101, 1785070000, {
          startTime: '13:00',
          durationMinutes: 45,
        });
      });

      // The backend accepted the save and now reports the slot at 13:00.
      const savedRaws: RawMentorTimeslot[] = [
        {
          id: 101,
          type: 'ALLOW' as const,
          dtstart: result.current.parsedDraft[0].occurrenceUnix,
          dtend: result.current.parsedDraft[0].occurrenceUnix + 2700,
          rrule: undefined,
          exdate: [],
        },
      ];
      vi.mocked(syncMonths).mockResolvedValue([
        { monthKey: '2026-07', outcome: { ok: true, raws: savedRaws } },
      ]);

      await act(async () => {
        const outcome = await result.current.editor!.confirmChanges();
        expect(outcome.ok).toBe(true);
      });

      mockLoadMonthSchedule.mockResolvedValue(savedRaws);
      await act(async () => {
        await result.current.reader.reload?.();
      });

      expect(result.current.parsedDraft).toHaveLength(1);
      expect(result.current.parsedDraft[0].occurrenceUnix).toBe(
        savedRaws[0].dtstart
      );
      expect(result.current.editor!.draftForSelectedDate).toEqual(
        result.current.parsedDraft.filter(
          (p) => p.dateKey === result.current.reader.selectedDate
        )
      );
    });
  });

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
      const res = result.current.editor!.updateDraftSlot(101, 1785070000, {
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
      result.current.editor!.deleteDraftSlot(101, 1785070000);
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
      const res = result.current.editor!.updateDraftSlot(101, 1785070000, {
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
      const res = result.current.editor!.updateDraftSlot(101, 1785070000, {
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
      result.current.reader.setSelectedDate('2026-03-24');
    });

    act(() => {
      // March 24 2026 is a Tuesday; within March this produces exactly two
      // weekly occurrences (24th and 31st) before crossing into April.
      result.current.editor!.addSlotForSelectedDate({
        startTime: '22:06',
        durationMinutes: 30,
        weeklyWithinMonth: true,
      });
    });

    expect(result.current.parsedDraft).toHaveLength(2);
    const recurringRowId = result.current.parsedDraft[0].id;
    const secondOccurrence = result.current.parsedDraft[1];

    act(() => {
      result.current.editor!.deleteDraftSlot(
        recurringRowId,
        secondOccurrence.occurrenceUnix
      );
    });

    expect(result.current.parsedDraft).toHaveLength(1);

    act(() => {
      result.current.reader.setSelectedDate(secondOccurrence.dateKey);
    });

    act(() => {
      // Re-add the exact same time/duration that was just deleted.
      result.current.editor!.addSlotForSelectedDate({
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
      result.current.reader.setSelectedDate('2026-03-24');
    });

    act(() => {
      result.current.editor!.addSlotForSelectedDate({
        startTime: '22:06',
        durationMinutes: 30,
        weeklyWithinMonth: true,
      });
    });

    expect(result.current.parsedDraft).toHaveLength(2);
    const recurringRowId = result.current.parsedDraft[0].id;
    const secondOccurrence = result.current.parsedDraft[1];

    act(() => {
      result.current.editor!.deleteDraftSlot(
        recurringRowId,
        secondOccurrence.occurrenceUnix
      );
    });

    act(() => {
      result.current.reader.setSelectedDate(secondOccurrence.dateKey);
    });

    act(() => {
      // Same start time, but a different duration than the deleted
      // occurrence - should NOT be treated as a restore.
      result.current.editor!.addSlotForSelectedDate({
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
      result.current.editor!.deleteDraftSlot(101, 1785070000);
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

    mockLoadMonthSchedule.mockResolvedValue(mockRawsJuly);
    // The parent row is already loaded for August too - a cross-month edit
    // reads the target month straight off the read model, and the calendar's
    // own next-month prefetch is mocked out here.
    scheduleReadModel.set(scheduleKey(8), mockRawsJuly);

    const { result } = renderHook(() =>
      useMentorSchedule({
        backend: { userId: '123', year: 2026, month: 7 },
        loginUserId: '123',
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
      const res = result.current.editor!.updateDraftSlot(101, 1785674800, {
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
    await result.current.editor!.confirmChanges();
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

    mockLoadMonthSchedule.mockResolvedValue(mockRawsJuly);
    // August is loaded and empty, so the slot has somewhere to move to.
    scheduleReadModel.set(scheduleKey(8), []);

    const { result } = renderHook(() =>
      useMentorSchedule({
        backend: { userId: '123', year: 2026, month: 7 },
        loginUserId: '123',
      })
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.parsedDraft).toHaveLength(1);

    // Edit occurrence of slot 101, but the base Date is set to August 2, 2026 (1785674800)
    // Under the new code, this non-recurring slot is correctly removed from July and added to August buffer.
    act(() => {
      const res = result.current.editor!.updateDraftSlot(101, 1785674800, {
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
    await result.current.editor!.confirmChanges();
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

    // July is loaded; August is deliberately left unread, so the read model
    // has no rows for it to hand the store.
    mockLoadMonthSchedule.mockResolvedValue(mockRawsJuly);

    const { result } = renderHook(() =>
      useMentorSchedule({
        backend: { userId: '123', year: 2026, month: 7 },
        loginUserId: '123',
      })
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.parsedDraft).toHaveLength(1);

    // Edit the slot to August 2, 2026 (1785674800)
    // Since August has a cache miss, updateDraftSlot should return TARGET_MONTH_NOT_LOADED, blocking the edit
    act(() => {
      const res = result.current.editor!.updateDraftSlot(101, 1785674800, {
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

    mockLoadMonthSchedule.mockResolvedValue(mockRawsJuly);
    scheduleReadModel.set(scheduleKey(8), mockRawsAugust);

    const { result } = renderHook(() =>
      useMentorSchedule({
        backend: { userId: '123', year: 2026, month: 7 },
        loginUserId: '123',
      })
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    // Edit slot 101 to August 2 at 13:00 (1785674800 with patch 13:00 results in 1785675600)
    // This overlaps with August slot 202, so it should be blocked and return OVERLAP!
    act(() => {
      const res = result.current.editor!.updateDraftSlot(101, 1785674800, {
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

    mockLoadMonthSchedule.mockResolvedValue(mockRawsJuly);
    // The parent row is loaded for August too, so the exdate has to reach
    // both monthly buffers.
    scheduleReadModel.set(scheduleKey(8), mockRawsJuly);

    const { result } = renderHook(() =>
      useMentorSchedule({
        backend: { userId: '123', year: 2026, month: 7 },
        loginUserId: '123',
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
      result.current.editor!.deleteDraftSlot(101, 1785674800);
    });

    // Total active occurrences should now be 1:
    // - Only the July 26 occurrence (since August 2 is exdated on all copies of parent row 101)
    expect(result.current.parsedDraft).toHaveLength(1);

    const julyOcc = result.current.parsedDraft[0];
    expect(julyOcc.occurrenceUnix).toBe(1785070000); // Only the July 26 occurrence remains
    expect(julyOcc.id).toBe(101);

    // Verify both months are marked dirty by ensuring confirmChanges requests syncing for both (Testing Finding 1)
    const mockSyncMonths = vi.mocked(syncMonths);
    await result.current.editor!.confirmChanges();
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
      const res = result.current.editor!.updateDraftSlot(101, 1785070000, {
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
      result.current.editor!.resetChanges();
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

    mockLoadMonthSchedule.mockImplementation(async (ref) => {
      if (ref.userId === 'userA') return userARaws;
      if (ref.userId === 'userB') return userBRaws;
      return [];
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

    // Same calendar month key ('2026-07'), different user - the buffer must
    // not be mistaken for already-loaded just because that month key was
    // seen before under a different account.
    rerender({ backend: { userId: 'userB', year: 2026, month: 7 } });

    await waitFor(() => {
      expect(result.current.parsedDraft[0]?.id).toBe(201);
    });
  });

  it('confirmChanges still reports a real save failure even if the account switches away before syncMonths resolves', async () => {
    mockLoadMonthSchedule.mockResolvedValue(defaultMockRaws);

    const { result, rerender } = renderHook(
      (props: {
        backend: { userId: string; year: number; month: number };
        loginUserId?: string;
      }) => useMentorSchedule(props),
      {
        initialProps: {
          backend: { userId: 'userA', year: 2026, month: 7 },
          loginUserId: 'userA',
        },
      }
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    act(() => {
      result.current.editor!.updateDraftSlot(101, 1785070000, {
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

    let confirmPromise!: ReturnType<
      NonNullable<typeof result.current.editor>['confirmChanges']
    >;
    act(() => {
      confirmPromise = result.current.editor!.confirmChanges();
    });

    // Account switches away while the save is still in flight.
    rerender({
      backend: { userId: 'userB', year: 2026, month: 7 },
      loginUserId: 'userB',
    });

    resolveSync([
      {
        monthKey: '2026-07',
        outcome: { ok: false, reason: 'conflict', message: 'boom' },
      },
    ]);

    const outcome = await confirmPromise;
    // The real failure must surface - not silently reported as success just
    // because the store it would have committed into has since moved on.
    expect(outcome.ok).toBe(false);
  });

  it('resetChanges fallback uses the snapshot captured before the refetch started, immune to an intervening account switch clearing the store', async () => {
    let sawUserA = false;
    mockLoadMonthSchedule.mockImplementation((ref) => {
      if (ref.userId === 'userA') {
        if (sawUserA) {
          // Viewing userA again after switching away: the account switch
          // dropped userA's cached month, and this second read never settles,
          // so the store isn't repopulated before resetChanges' fallback runs.
          return new Promise<RawMentorTimeslot[]>(() => {});
        }
        sawUserA = true;
        return Promise.resolve(defaultMockRaws);
      }
      return Promise.resolve([]);
    });

    let rejectFresh!: (err: Error) => void;
    vi.mocked(loadMonthScheduleFresh).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectFresh = reject;
        })
    );

    const { result, rerender } = renderHook(
      (props: {
        backend: { userId: string; year: number; month: number };
        loginUserId?: string;
      }) => useMentorSchedule(props),
      {
        initialProps: {
          backend: { userId: 'userA', year: 2026, month: 7 },
          loginUserId: 'userA',
        },
      }
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });
    expect(result.current.parsedDraft).toHaveLength(1);

    act(() => {
      result.current.editor!.updateDraftSlot(101, 1785070000, {
        startTime: '13:00',
        durationMinutes: 45,
      });
    });

    // Start the reset - this must capture a snapshot of userA's saved data
    // synchronously, before the refetch (and the account switches below)
    // have any chance to run.
    act(() => {
      result.current.editor!.resetChanges();
    });

    // Switch away and back to the same user while the refetch is still
    // pending - each switch clears the store via store.clearAll().
    rerender({
      backend: { userId: 'userB', year: 2026, month: 7 },
      loginUserId: 'userB',
    });
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });
    rerender({
      backend: { userId: 'userA', year: 2026, month: 7 },
      loginUserId: 'userA',
    });

    // The pending refetch now fails.
    act(() => {
      rejectFresh(new Error('network down'));
    });

    // Must fall back to the ORIGINAL saved slot (id 101), not an empty
    // array - even though the store's live state for userA was still
    // empty (cache miss, stuck revalidate) at the moment the fallback ran.
    await waitFor(() => {
      expect(result.current.parsedDraft).toHaveLength(1);
    });
    expect(result.current.parsedDraft[0]?.id).toBe(101);
  });

  describe('failed fetch vs empty schedule distinction (issue 620)', () => {
    it('sets hasError to false when fetch succeeds with empty array (genuinely no availability)', async () => {
      mockLoadMonthSchedule.mockResolvedValue([]);

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: '123', year: 2026, month: 7 },
        })
      );

      await waitFor(() => {
        expect(result.current.reader.slotsSnapshot.monthLoaded).toBe(true);
      });

      expect(result.current.reader.hasError).toBe(false);
      expect(result.current.parsedDraft).toHaveLength(0);
    });

    it('sets hasError to true when fetch fails and there is no cache/buffer', async () => {
      mockLoadMonthSchedule.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: '123', year: 2026, month: 7 },
        })
      );

      await waitFor(() => {
        expect(result.current.reader.slotsSnapshot.monthLoaded).toBe(true);
      });

      expect(result.current.reader.hasError).toBe(true);
      expect(result.current.parsedDraft).toHaveLength(0);
    });

    it('clears error and retries successfully when reload is called', async () => {
      mockLoadMonthScheduleFresh.mockReset();
      // First attempt fails.
      mockLoadMonthSchedule.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: '123', year: 2026, month: 7 },
        })
      );

      await waitFor(() => {
        expect(result.current.reader.slotsSnapshot.monthLoaded).toBe(true);
      });

      expect(result.current.reader.hasError).toBe(true);

      // The retry succeeds with a genuinely empty schedule.
      mockLoadMonthSchedule.mockResolvedValue([]);

      await act(async () => {
        await result.current.reader.reload?.();
      });

      expect(result.current.reader.slotsSnapshot.monthLoaded).toBe(true);
      expect(result.current.reader.hasError).toBe(false);
      expect(scheduleReadModel.get(scheduleKey(7))).toEqual([]);
    });

    it('shows the month as loading (and drops the error) while a user-triggered retry is in flight', async () => {
      mockLoadMonthSchedule.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: '123', year: 2026, month: 7 },
        })
      );

      await waitFor(() => {
        expect(result.current.reader.hasError).toBe(true);
      });

      const retry = deferredMonth();
      mockLoadMonthSchedule.mockReturnValue(retry.promise);

      let reloadPromise!: Promise<void>;
      act(() => {
        reloadPromise = result.current.reader.reload!();
      });

      expect(result.current.reader.hasError).toBe(false);
      expect(result.current.reader.slotsSnapshot.monthLoaded).toBe(false);
      expect(result.current.reader.isFetching).toBe(true);

      await act(async () => {
        retry.resolve([]);
        await reloadPromise;
      });

      expect(result.current.reader.slotsSnapshot.monthLoaded).toBe(true);
      expect(result.current.reader.hasError).toBe(false);
    });
  });

  describe('reservations integration (#601)', () => {
    // Cursor pagination, the stuck-cursor guard, the end-of-month guard, and
    // fetch-failure handling live in fetchAllReservationsForState now (moved
    // to src/services/reservations/reservationService.ts - see
    // reservationService.test.ts). These tests only cover the hook's own
    // responsibility: gating the fetch on loginUserId and wiring the
    // resolved reservations into state / generateBookingSlots.
    it('does not fetch reservations when loginUserId is not provided', async () => {
      mockLoadMonthSchedule.mockResolvedValue([]);

      renderHook(() =>
        useMentorSchedule({
          backend: { userId: 'mentor-1', year: 2026, month: 7 },
        })
      );

      expect(mockFetchAllReservationsForState).not.toHaveBeenCalled();
    });

    it('does not fetch reservations when loginUserId is provided but does not match backend.userId', async () => {
      mockLoadMonthSchedule.mockResolvedValue([]);

      renderHook(() =>
        useMentorSchedule({
          backend: { userId: 'mentor-1', year: 2026, month: 7 },
          loginUserId: 'mentee-2',
        })
      );

      expect(mockFetchAllReservationsForState).not.toHaveBeenCalled();
    });

    it('fetches MENTOR_UPCOMING and MENTOR_PENDING reservations when loginUserId is provided', async () => {
      mockLoadMonthSchedule.mockResolvedValue([]);

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
        expect(result.current.editor!.reservations).toHaveLength(2);
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

      const resUpcoming = result.current.editor!.reservations.find(
        (r) => r.id === 'res-upcoming'
      );
      const resPending = result.current.editor!.reservations.find(
        (r) => r.id === 'res-pending'
      );
      expect(resUpcoming).toBeDefined();
      expect(resPending).toBeDefined();
    });

    it('serves reservations from cache without calling fetchAllReservationsForState on a cache hit', async () => {
      mockLoadMonthSchedule.mockResolvedValue([]);

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

      const eom = computeEndOfMonthUnix(2026, 7);
      reservationReadModel.set(
        reservationKey('MENTOR_UPCOMING', eom, 'mentor-1'),
        {
          items: cachedUpcoming,
          next_dtend: 0,
        }
      );
      reservationReadModel.set(
        reservationKey('MENTOR_PENDING', eom, 'mentor-1'),
        {
          items: cachedPending,
          next_dtend: 0,
        }
      );
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
        expect(result.current.editor!.reservations).toHaveLength(2);
      });

      expect(mockFetchAllReservationsForState).not.toHaveBeenCalled();
      expect(
        result.current.editor!.reservations.find(
          (r) => r.id === 'res-cached-upcoming'
        )
      ).toBeDefined();
      expect(
        result.current.editor!.reservations.find(
          (r) => r.id === 'res-cached-pending'
        )
      ).toBeDefined();
    });

    it('primes the reservations cache after a network fetch on a cache miss, bounded by the calendar TTL policy', async () => {
      mockLoadMonthSchedule.mockResolvedValue([]);
      mockFetchAllReservationsForState.mockResolvedValue([]);

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: 'mentor-1', year: 2026, month: 7 },
          loginUserId: 'mentor-1',
        })
      );

      await waitFor(() => {
        expect(result.current.reader.slotsSnapshot.reservationsLoaded).toBe(
          true
        );
      });

      const eom = computeEndOfMonthUnix(2026, 7);
      const upcoming = reservationKey('MENTOR_UPCOMING', eom, 'mentor-1');
      const pending = reservationKey('MENTOR_PENDING', eom, 'mentor-1');
      expect(reservationReadModel.get(upcoming)).toEqual({
        items: [],
        next_dtend: 0,
      });
      expect(reservationReadModel.get(pending)).toEqual({
        items: [],
        next_dtend: 0,
      });

      // Both slots carry the calendar's TTL policy
      // (MENTOR_SCHEDULE_RESERVATIONS_TTL_MS), rather than the read model's
      // default permanent, invalidate-driven slot: jump past the window and
      // they are gone. Asserted through the model's own read, not through a
      // spy on the call the hook happened to make.
      const now = Date.now();
      const nowSpy = vi
        .spyOn(Date, 'now')
        .mockReturnValue(now + MENTOR_SCHEDULE_RESERVATIONS_TTL_MS);
      expect(reservationReadModel.get(upcoming)).toBeUndefined();
      expect(reservationReadModel.get(pending)).toBeUndefined();
      nowSpy.mockRestore();
    });

    it('reload() re-fetches this month unconditionally and re-primes its own two keys with the fresh result, without invalidating anything by hand', async () => {
      mockLoadMonthSchedule.mockResolvedValue([]);
      mockFetchAllReservationsForState.mockResolvedValue([]);

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: 'mentor-1', year: 2026, month: 7 },
          loginUserId: 'mentor-1',
        })
      );

      await waitFor(() => {
        expect(result.current.reader.slotsSnapshot.reservationsLoaded).toBe(
          true
        );
      });

      mockFetchAllReservationsForState.mockClear();
      // A month unrelated to the one being reloaded, and the dashboard's own
      // unscoped slot for this same state - reload() must leave both alone.
      // The write path itself (acceptReservation / rejectOrCancelReservation
      // / createReservation) now owns invalidating whatever those mutations
      // actually affect (X-Tracker #651); reload() itself never calls
      // invalidate()/clear() any more - it only re-fetches and re-primes its
      // own current month.
      const otherMonthEom = computeEndOfMonthUnix(2026, 8);
      reservationReadModel.set(
        reservationKey('MENTOR_UPCOMING', otherMonthEom, 'mentor-1'),
        { items: [], next_dtend: 0 }
      );
      reservationReadModel.set(
        { userId: 'mentor-1', state: 'MENTOR_UPCOMING' },
        { items: [], next_dtend: 0 }
      );
      const invalidateSpy = vi.spyOn(reservationReadModel, 'invalidate');
      const clearSpy = vi.spyOn(reservationReadModel, 'clear');

      await act(async () => {
        await result.current.reader.reload?.();
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
      expect(invalidateSpy).not.toHaveBeenCalled();
      expect(clearSpy).not.toHaveBeenCalled();
      const eom = computeEndOfMonthUnix(2026, 7);
      expect(
        reservationReadModel.get(
          reservationKey('MENTOR_UPCOMING', eom, 'mentor-1')
        )
      ).toEqual({ items: [], next_dtend: 0 });
      expect(
        reservationReadModel.get(
          reservationKey('MENTOR_PENDING', eom, 'mentor-1')
        )
      ).toEqual({ items: [], next_dtend: 0 });
      // Other months and the dashboard's unscoped slot are untouched.
      expect(
        reservationReadModel.get(
          reservationKey('MENTOR_UPCOMING', otherMonthEom, 'mentor-1')
        )
      ).toEqual({ items: [], next_dtend: 0 });
      expect(
        reservationReadModel.get({
          userId: 'mentor-1',
          state: 'MENTOR_UPCOMING',
        })
      ).toEqual({ items: [], next_dtend: 0 });
    });

    it('reload() leaves this month? previously-cached keys untouched when the refetch fails', async () => {
      mockLoadMonthSchedule.mockResolvedValue([]);
      mockFetchAllReservationsForState.mockResolvedValue([]);

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: 'mentor-1', year: 2026, month: 7 },
          loginUserId: 'mentor-1',
        })
      );

      await waitFor(() => {
        expect(result.current.reader.slotsSnapshot.reservationsLoaded).toBe(
          true
        );
      });

      const eom = computeEndOfMonthUnix(2026, 7);
      // Seed this month's keys, as an earlier successful mount/reload would
      // have - a failed reload must leave them exactly as they were
      // (bounded by MENTOR_SCHEDULE_RESERVATIONS_TTL_MS) rather than
      // evicting them outright.
      reservationReadModel.set(
        reservationKey('MENTOR_UPCOMING', eom, 'mentor-1'),
        { items: [], next_dtend: 0 },
        MENTOR_SCHEDULE_RESERVATIONS_TTL_MS
      );
      reservationReadModel.set(
        reservationKey('MENTOR_PENDING', eom, 'mentor-1'),
        { items: [], next_dtend: 0 },
        MENTOR_SCHEDULE_RESERVATIONS_TTL_MS
      );

      const setSpy = vi.spyOn(reservationReadModel, 'set');
      // A mutation (e.g. accept/reject) is what would normally trigger this
      // reload; the network fetch it kicks off then fails.
      mockFetchAllReservationsForState.mockRejectedValue(
        new Error('network down')
      );

      await act(async () => {
        await result.current.reader.reload?.();
      });

      expect(
        reservationReadModel.get(
          reservationKey('MENTOR_UPCOMING', eom, 'mentor-1')
        )
      ).toEqual({ items: [], next_dtend: 0 });
      expect(
        reservationReadModel.get(
          reservationKey('MENTOR_PENDING', eom, 'mentor-1')
        )
      ).toEqual({ items: [], next_dtend: 0 });
      expect(setSpy).not.toHaveBeenCalled();
    });

    it('clears the reservations cache when the backend user switches', async () => {
      mockLoadMonthSchedule.mockResolvedValue([]);
      mockFetchAllReservationsForState.mockResolvedValue([]);

      const { result, rerender } = renderHook(
        (props: { backend: { userId: string; year: number; month: number } }) =>
          useMentorSchedule({ ...props, loginUserId: props.backend.userId }),
        { initialProps: { backend: { userId: 'userA', year: 2026, month: 7 } } }
      );

      await waitFor(() => {
        expect(result.current.reader.slotsSnapshot.reservationsLoaded).toBe(
          true
        );
      });

      const clearSpy = vi.spyOn(reservationReadModel, 'clear');
      expect(clearSpy).not.toHaveBeenCalled();

      rerender({ backend: { userId: 'userB', year: 2026, month: 7 } });

      await waitFor(() => {
        expect(clearSpy).toHaveBeenCalled();
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

      mockLoadMonthSchedule.mockResolvedValue(mockRaws);

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
        result.current.reader.setSelectedDate('2026-09-26');
      });
      const slots = result.current.reader.slotsSnapshot.slots;
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
      mockLoadMonthSchedule.mockResolvedValue(defaultMockRaws);

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
        expect(result.current.reader.slotsSnapshot.monthLoaded).toBe(true);
      });
      expect(result.current.reader.slotsSnapshot.reservationsLoaded).toBe(
        false
      );

      await waitFor(() => {
        expect(resolveFetchers).toHaveLength(2);
      });

      await act(async () => {
        resolveFetchers.forEach((resolve) => resolve([]));
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.reader.slotsSnapshot.reservationsLoaded).toBe(
          true
        );
      });
    });

    it('reports the failure and leaves reservationsLoaded false when the reservations fetch throws unexpectedly', async () => {
      // fetchAllReservationsForState itself never rejects in production (it
      // swallows its own errors, see reservationService.ts), but this
      // exercises the hook's own defense-in-depth catch for anything else
      // that could throw. reservationsLoaded must stay false here - it's
      // only ever set true on the success path, deliberately not in a
      // `finally` (which would run on this failure too and mark the flag
      // loaded despite `reservations` never actually being written).
      mockLoadMonthSchedule.mockResolvedValue(defaultMockRaws);
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

      expect(result.current.reader.slotsSnapshot.reservationsLoaded).toBe(
        false
      );
    });
  });

  describe('reload (#604)', () => {
    it('successfully reloads reservations and schedule and updates state/store', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(
        new Date('2026-07-01T00:00:00Z').getTime()
      );

      mockLoadMonthSchedule.mockReset();

      // What the backend returns once the schedule has been reloaded.
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

      mockLoadMonthSchedule.mockResolvedValue(defaultMockRaws);

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
      mockLoadMonthSchedule.mockResolvedValue(reloadedRaws);

      // Trigger reload
      await act(async () => {
        await result.current.reader.reload?.();
      });

      // Verify reservations are refreshed
      expect(result.current.editor!.reservations).toHaveLength(1);
      expect(result.current.editor!.reservations[0].id).toBe('res-reload');

      // The month was re-read from the backend rather than served from the
      // cache the mount read had just filled, and the read model now holds
      // exactly what the backend returned.
      expect(mockLoadMonthSchedule).toHaveBeenCalledTimes(2);
      expect(mockLoadMonthSchedule).toHaveBeenLastCalledWith(
        { userId: '123', year: 2026, month: 7 },
        expect.anything()
      );
      expect(scheduleReadModel.get(scheduleKey(7))).toEqual(reloadedRaws);

      // Verify calendar slots are updated with new mentee name
      act(() => {
        result.current.reader.setSelectedDate('2026-07-26');
      });
      const slots = result.current.reader.slotsSnapshot.slots;
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
      mockLoadMonthSchedule.mockReset().mockResolvedValue(defaultMockRaws);

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
      mockLoadMonthSchedule.mockRejectedValue(
        new Error('schedule refetch failed')
      );

      // Neither reloadReservations nor reloadSchedule rethrow: reload() must
      // resolve cleanly rather than reject or crash the caller.
      await expect(
        act(async () => {
          await result.current.reader.reload?.();
        })
      ).resolves.toBeUndefined();

      // State is left as-is (pre-failure) rather than cleared or corrupted.
      expect(result.current.editor!.reservations).toEqual([]);
      expect(result.current.parsedDraft).toHaveLength(1);
    });

    it('does not apply reloaded schedule or reservations if the active user changes mid-flight', async () => {
      mockFetchAllReservationsForState.mockReset().mockResolvedValue([]);
      mockLoadMonthScheduleFresh.mockReset();
      mockLoadMonthSchedule.mockReset();

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

      // The reload's own request hangs long enough for an account switch.
      const oldUserRefetch = deferredMonth();
      let sawUser123 = false;
      mockLoadMonthSchedule.mockImplementation((ref) => {
        if (ref.userId !== '123') return Promise.resolve([]);
        if (sawUser123) return oldUserRefetch.promise;
        sawUser123 = true;
        return Promise.resolve(defaultMockRaws);
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

      const reloadPromise = result.current.reader.reload?.();

      // Change user mid-flight (account switch)
      act(() => {
        rerender({ userId: '456' });
      });

      // Resolve the fetch for the OLD user ('123')
      oldUserRefetch.resolve(reloadedRaws);

      await act(async () => {
        await reloadPromise;
      });

      // Ensure the old user's reloaded data is NOT applied
      expect(result.current.editor!.reservations).toEqual([]);
      // Should not contain 1785075000 (old user's reloaded schedule)
      const hasOldReloaded = result.current.parsedDraft.some(
        (d) => d.start.getTime() === 1785075000 * 1000
      );
      expect(hasOldReloaded).toBe(false);
      // ...nor cached under the new user's key, so it cannot resurface on a
      // later swipe back to this month.
      expect(scheduleReadModel.get(scheduleKey(7, '456'))).toEqual([]);
    });

    it('does not discard unsaved draft edits when reloading schedule', async () => {
      mockFetchAllReservationsForState.mockReset().mockResolvedValue([]);
      mockLoadMonthScheduleFresh.mockReset();
      mockLoadMonthSchedule.mockReset().mockResolvedValue(defaultMockRaws);

      // What the reload reads back from the backend.
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
        result.current.editor!.updateDraftSlot(101, 1785070000, {
          startTime: '13:00',
        });
      });

      const draftBeforeReload = result.current.parsedDraft;

      // Trigger reload
      mockLoadMonthSchedule.mockResolvedValue(reloadedRaws);
      await act(async () => {
        await result.current.reader.reload?.();
      });

      // Verify the dirty draft is preserved and not discarded or overwritten
      expect(result.current.parsedDraft).toEqual(draftBeforeReload);
    });

    it('does not apply state update or trigger errors if the component unmounts mid-flight of reload', async () => {
      mockFetchAllReservationsForState.mockReset();
      mockLoadMonthScheduleFresh.mockReset();

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

      const refetch = deferredMonth();
      let sawFirstRead = false;
      mockLoadMonthSchedule.mockReset().mockImplementation(() => {
        if (sawFirstRead) return refetch.promise;
        sawFirstRead = true;
        return Promise.resolve(defaultMockRaws);
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
        await result.current.reader.reload?.();
      });

      // Unmount the component while reload is in-flight
      unmount();

      // Resolve the fetches
      resolveReservations([]);
      refetch.resolve([]);

      await reloadPromise;

      // Ensure no state update warning occurred and state is stable
      expect(result.current.editor!.reservations).toEqual([]);
    });

    it('does not capture flow failure if reload schedule fails after account has already switched or component unmounted', async () => {
      mockFetchAllReservationsForState.mockReset().mockResolvedValue([]);
      mockLoadMonthScheduleFresh.mockReset();
      mockCaptureFlowFailure.mockReset();

      // The reload's request for the OLD user fails, but only after the
      // account has already been switched away from it.
      const oldUserRefetch = deferredMonth();
      let sawUser123 = false;
      mockLoadMonthSchedule.mockReset().mockImplementation((ref) => {
        if (ref.userId !== '123') return Promise.resolve([]);
        if (sawUser123) return oldUserRefetch.promise;
        sawUser123 = true;
        return Promise.resolve(defaultMockRaws);
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

      const reloadPromise = result.current.reader.reload?.();

      // Switch user mid-flight
      act(() => {
        rerender({ userId: '456' });
      });

      // Reject the schedule fetch for the OLD user
      oldUserRefetch.reject(new Error('old user fetch failed'));

      await act(async () => {
        await reloadPromise;
      });

      // Verify that captureFlowFailure was NOT called because the user has switched
      expect(mockCaptureFlowFailure).not.toHaveBeenCalled();
    });

    it('does not apply reloaded reservations if the calendar month changes mid-flight', async () => {
      mockFetchAllReservationsForState.mockReset().mockResolvedValue([]);
      mockLoadMonthScheduleFresh.mockReset().mockResolvedValue([]);

      mockLoadMonthSchedule.mockResolvedValue(defaultMockRaws);

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

      const reloadPromise = result.current.reader.reload?.();

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
      expect(result.current.editor!.reservations).toEqual([]);
    });

    it('a month request still in flight when the calendar moves on never lands on the month now on screen', async () => {
      mockFetchAllReservationsForState.mockReset().mockResolvedValue([]);
      mockLoadMonthScheduleFresh.mockReset();
      mockLoadMonthSchedule.mockReset().mockResolvedValue(defaultMockRaws);

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

      // July's reload hangs; August answers immediately.
      const julyRefetch = deferredMonth();
      mockLoadMonthSchedule.mockImplementation((ref) =>
        ref.month === 7 ? julyRefetch.promise : Promise.resolve([])
      );

      const reloadPromise = result.current.reader.reload?.();

      // Change month to 8 mid-flight
      act(() => {
        rerender({ month: 8 });
      });

      // July's rows finally arrive, keyed to July - not to the August the
      // calendar is now showing.
      const julyRaws: RawMentorTimeslot[] = [
        {
          id: 101,
          type: 'ALLOW',
          dtstart: 1785070000,
          dtend: 1785071800,
          rrule: undefined,
          exdate: [],
        },
      ];
      julyRefetch.resolve(julyRaws);

      await act(async () => {
        await reloadPromise;
      });

      const hasAugustSlots = result.current.parsedDraft.some((slot) =>
        slot.dateKey.startsWith('2026-08')
      );
      expect(hasAugustSlots).toBe(false);
      // July's own slot is where it belongs, and August's is untouched.
      expect(scheduleReadModel.get(scheduleKey(7))).toEqual(julyRaws);
      expect(scheduleReadModel.get(scheduleKey(8))).toEqual([]);
    });

    it('a slower mount-effect reservations fetch cannot clobber a faster reload() with stale data', async () => {
      // Regression test for a race the AI review pipeline flagged on PR
      // #1083 (X-Tracker #650): the mount effect and reload() both resolve
      // to "the reservations for the current (userId, year, month)", and
      // identity alone (isStale's userId/year/month check) can't tell two
      // competing fetches for that SAME identity apart. If a mutation
      // (accept/reject) triggers reload() while the mount effect's own
      // fetch is still in flight, the mount effect's slower, now-stale
      // response must not win - neither in local state nor in the shared
      // cache it writes back to.
      const makeRes = (id: string) => ({
        id,
        name: id,
        roleLine: '',
        date: '',
        time: '',
        messages: [],
        scheduleId: 1,
        dtstart: 1785070000,
        dtend: 1785071800,
        senderUserId: 'mentee-1',
        participantUserId: 'mentor-1',
        version: 0,
      });

      mockLoadMonthSchedule.mockResolvedValue([]);

      const resolvers: Array<
        (val: Awaited<ReturnType<typeof fetchAllReservationsForState>>) => void
      > = [];
      mockFetchAllReservationsForState.mockImplementation(
        () => new Promise((resolve) => resolvers.push(resolve))
      );

      const { result } = renderHook(() =>
        useMentorSchedule({
          backend: { userId: 'mentor-1', year: 2026, month: 7 },
          loginUserId: 'mentor-1',
        })
      );

      // The mount effect has issued its two (slow) fetches: [0]=UPCOMING, [1]=PENDING.
      await waitFor(() => expect(resolvers).toHaveLength(2));

      let reloadSettled = false;
      const reloadPromise = result.current.reader.reload!().then(() => {
        reloadSettled = true;
      });

      // reload() issues its own two fetches on top of the still-pending
      // mount ones: [2]=UPCOMING, [3]=PENDING.
      await waitFor(() => expect(resolvers).toHaveLength(4));

      // reload()'s fetches resolve first and should win.
      resolvers[2]([makeRes('fresh-upcoming')]);
      resolvers[3]([makeRes('fresh-pending')]);
      await act(async () => {
        await reloadPromise;
      });
      expect(reloadSettled).toBe(true);
      expect(
        result.current.editor!.reservations.map((r) => r.id).sort()
      ).toEqual(['fresh-pending', 'fresh-upcoming']);

      // The mount effect's slower fetch finally resolves with stale,
      // pre-mutation data.
      await act(async () => {
        resolvers[0]([makeRes('stale-upcoming')]);
        resolvers[1]([makeRes('stale-pending')]);
        await Promise.resolve();
        await Promise.resolve();
      });

      // The stale response must not have overwritten reload()'s fresher
      // result, in local state or in the shared cache.
      expect(
        result.current.editor!.reservations.map((r) => r.id).sort()
      ).toEqual(['fresh-pending', 'fresh-upcoming']);
      const eom = computeEndOfMonthUnix(2026, 7);
      expect(
        reservationReadModel
          .get(reservationKey('MENTOR_UPCOMING', eom, 'mentor-1'))
          ?.items.map((r) => r.id)
      ).toEqual(['fresh-upcoming']);
      expect(
        reservationReadModel
          .get(reservationKey('MENTOR_PENDING', eom, 'mentor-1'))
          ?.items.map((r) => r.id)
      ).toEqual(['fresh-pending']);
    });
  });
});
