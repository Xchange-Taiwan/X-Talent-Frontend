'use client';

import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(isSameOrBefore);

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MonthDraftStore } from '@/lib/profile/MonthDraftStore';
import {
  BookingSlot,
  deduplicateBookingSlots,
  deduplicateRawSlots,
  expandRrule,
  formatTimeslot,
  MonthKey,
  monthKeyFromYearMonth,
  ParsedMentorTimeslot,
  parseMonthKey,
  RawMentorTimeslot,
} from '@/lib/profile/scheduleHelpers';
import { TimeSlotDTO, utcYearMonth } from '@/services/mentor-schedule/schedule';
import { scheduleCache } from '@/services/mentor-schedule/scheduleCache';
import {
  loadMonthScheduleCached,
  loadMonthScheduleFresh,
  MonthSyncRequest,
  prefetchMonthSchedule,
  ScheduleMonthRef,
  syncMonths,
  SyncResult,
} from '@/services/mentor-schedule/sync';

export type {
  BookingSlot,
  ParsedMentorTimeslot,
} from '@/lib/profile/scheduleHelpers';
export { expandRrule } from '@/lib/profile/scheduleHelpers';

type Options = {
  backend: {
    userId: string;
    year: number;
    month: number; // 1-12
  };
};

export type SlotDurationMinutes = 30 | 45 | 60;

export type UpdateDraftSlotResult = {
  success: boolean;
  reason?: 'OVERLAP' | 'TARGET_MONTH_NOT_LOADED';
};

export type UseMentorScheduleReturn = {
  /** Sticky: true once any month has resolved. Use this for first-paint skeletons. */
  loaded: boolean;
  /** Per-month: false while the *current* (year, month) is being fetched after a cache miss. */
  monthLoaded: boolean;
  isFetching: boolean;
  selectedDate: string | null;
  setSelectedDate: (dateStr: string | null) => void;

  parsedDraft: ParsedMentorTimeslot[];
  draftForSelectedDate: ParsedMentorTimeslot[];
  /** All local dates (YYYY-MM-DD) that have at least one ALLOW occurrence after expanding rrules. */
  allowedDates: string[];

  generateBookingSlots: (dateKey: string) => BookingSlot[];

  /**
   * Add one ALLOW entry at `startTime` for `durationMinutes`. If
   * `weeklyWithinMonth` is true, the entry is a single row with a weekly
   * `FREQ=WEEKLY;COUNT=N` rrule covering every same-weekday date remaining in
   * the selected date's month; otherwise it's a non-recurring row. Returns
   * counts of created occurrences so callers can show "added N, skipped M".
   */
  addSlotForSelectedDate: (opts: {
    startTime: string; // HH:mm
    durationMinutes: SlotDurationMinutes;
    weeklyWithinMonth?: boolean;
  }) => { added: number; skipped: number };

  /**
   * Edit a single occurrence. For non-recurring rows this updates the row
   * directly. For recurring rows the targeted occurrence is detached: it is
   * added to the parent's exdate and a new non-recurring row is created with
   * the patch applied — leaving sibling occurrences untouched.
   */
  updateDraftSlot: (
    id: number,
    occurrenceUnix: number,
    patch: {
      startTime?: string; // HH:mm
      durationMinutes?: SlotDurationMinutes;
    }
  ) => UpdateDraftSlotResult;

  /**
   * Delete a single occurrence. Non-recurring rows are removed entirely; on
   * recurring rows the occurrence is added to exdate, and the row is removed
   * only when no active occurrences remain.
   */
  deleteDraftSlot: (id: number, occurrenceUnix: number) => void;

  confirmChanges: () => Promise<SyncResult>;
  resetChanges: () => void;
};

export function useMentorSchedule(opts: Options): UseMentorScheduleReturn {
  const { backend } = opts;

  // External standalone MonthDraftStore for cross-month states and synchronization logic
  const [store] = useState(() => new MonthDraftStore());
  const [storeState, setStoreState] = useState(() => store.snapshot());

  useEffect(() => {
    return store.subscribe((newSnap) => {
      setStoreState(newSnap);
    });
  }, [store]);

  const { savedByMonth, draftByMonth, pendingDeleteByMonth, dirtyMonths } =
    storeState;

  const [loaded, setLoaded] = useState(false);
  const [monthLoaded, setMonthLoaded] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    dayjs().format('YYYY-MM-DD')
  );

  const currentMonthKey = monthKeyFromYearMonth(backend.year, backend.month);

  // Mirror dirtyMonths into a ref so the load effect's per-month dirty guard
  // sees the latest value without re-subscribing.
  const dirtyMonthsRef = useRef<Set<MonthKey>>(dirtyMonths);
  useEffect(() => {
    dirtyMonthsRef.current = dirtyMonths;
  }, [dirtyMonths]);

  // Union of persisted ids across every loaded month. Slot ids are globally
  // unique, so checking membership across months is safe and lets toServiceSlot
  // emit the `id` field for any persisted slot regardless of which month
  // confirmChanges is currently building a payload for.
  const persistedIdSet = useMemo(() => {
    const s = new Set<number>();
    savedByMonth.forEach((raws) => {
      for (const r of raws) if (r.id > 0) s.add(r.id);
    });
    return s;
  }, [savedByMonth]);

  const toServiceSlot = useCallback(
    (r: RawMentorTimeslot): TimeSlotDTO => {
      const { year, month } = utcYearMonth(r.dtstart);
      const slot: TimeSlotDTO = {
        user_id: 0,
        dt_type: 'ALLOW',
        dt_year: year,
        dt_month: month,
        dtstart: r.dtstart,
        dtend: r.dtend,
        rrule: r.rrule,
        timezone: 'UTC',
        exdate: r.exdate,
      };
      if (r.id > 0 && persistedIdSet.has(r.id)) slot.id = r.id;
      return slot;
    },
    [persistedIdSet]
  );

  // Drop everything when the backend user changes — buffers belong to a
  // specific user.
  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      prevUserIdRef.current !== null &&
      prevUserIdRef.current !== backend.userId
    ) {
      scheduleCache.clear();
      store.reset([]);
      setLoaded(false);
    }
    prevUserIdRef.current = backend.userId;
  }, [backend.userId, store]);

  // Load the currently-viewed month into the buffer lazily. Months that are
  // already buffered (clean OR dirty) are not re-applied: the per-month dirty
  // guard inside `apply` protects unsaved edits even if a stale revalidate
  // resolves later. Background revalidate still updates clean months silently.
  useEffect(() => {
    if (!backend.userId || !backend.year || !backend.month) return;
    let ignore = false;

    const monthKey = currentMonthKey;
    const ref: ScheduleMonthRef = {
      userId: backend.userId,
      year: backend.year,
      month: backend.month,
    };

    const apply = (raws: RawMentorTimeslot[]) => {
      store.ensureMonthLoaded(monthKey, raws);
    };

    const hasBuffer = draftByMonth.has(monthKey);
    const { cached, revalidate } = loadMonthScheduleCached(ref);

    if (hasBuffer) {
      // Already buffered earlier in this session — no fetch needed.
      setLoaded(true);
      setMonthLoaded(true);
    } else if (cached) {
      apply(cached);
      setLoaded(true);
      setMonthLoaded(true);
    } else {
      // Cache miss + no buffer: skeleton until revalidate lands. monthLoaded
      // -> false so consumers can distinguish "fetching" from "settled empty";
      // sticky `loaded` is left untouched.
      setMonthLoaded(false);
      setIsFetching(true);
    }

    revalidate
      .then((raws) => {
        if (ignore) return;
        if (dirtyMonthsRef.current.has(monthKey)) return;
        if (cached && JSON.stringify(cached) === JSON.stringify(raws)) {
          setLoaded(true);
          setMonthLoaded(true);
          return;
        }
        apply(raws);
        setLoaded(true);
        setMonthLoaded(true);
      })
      .catch(() => {
        // Treat fetch failure as "settled" so the UI doesn't hang on a
        // skeleton; the user will see the empty state instead.
        if (!ignore && !cached && !hasBuffer) {
          setLoaded(true);
          setMonthLoaded(true);
        }
      })
      .finally(() => {
        if (!ignore) setIsFetching(false);
      });

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend.userId, backend.year, backend.month, store]);

  // Prefetch the next month after the current month finishes loading, so
  // forward navigation hits cache. Past months are intentionally skipped.
  useEffect(() => {
    if (!loaded || !backend.userId) return;
    const next = dayjs(`${backend.year}-${backend.month}-01`).add(1, 'month');
    const handle = setTimeout(() => {
      prefetchMonthSchedule({
        userId: backend.userId,
        year: next.year(),
        month: next.month() + 1,
      });
    }, 0);
    return () => clearTimeout(handle);
  }, [loaded, backend.userId, backend.year, backend.month]);

  // Flatten all per-month draft buffers so calendar derivations cover every
  // month the user has touched, not just the currently-viewed month.
  const allDraftRaws = useMemo(() => {
    const out: RawMentorTimeslot[] = [];
    draftByMonth.forEach((raws) => out.push(...raws));
    return deduplicateRawSlots(out);
  }, [draftByMonth]);

  const parsedDraft = useMemo(() => {
    const formatted = allDraftRaws.flatMap(formatTimeslot);
    const seen = new Set<string>();
    const out: ParsedMentorTimeslot[] = [];
    for (const slot of formatted) {
      if (!seen.has(slot.occurrenceId)) {
        seen.add(slot.occurrenceId);
        out.push(slot);
      }
    }
    return out.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [allDraftRaws]);

  const draftForSelectedDate = useMemo(
    () =>
      selectedDate
        ? parsedDraft.filter((p) => p.dateKey === selectedDate)
        : parsedDraft,
    [parsedDraft, selectedDate]
  );

  const allowedDates = useMemo(() => {
    const bookedStarts = new Set(
      allDraftRaws.filter((s) => s.type === 'BOOKED').map((s) => s.dtstart)
    );
    const nowSec = Math.floor(Date.now() / 1000);
    const dates = new Set<string>();
    for (const slot of allDraftRaws) {
      if (slot.type !== 'ALLOW') continue;
      const occurrences = expandRrule(slot.dtstart, slot.rrule);
      for (const occ of occurrences) {
        if (slot.exdate.includes(occ)) continue;
        if (occ <= nowSec) continue;
        if (bookedStarts.has(occ)) continue;
        dates.add(dayjs(occ * 1000).format('YYYY-MM-DD'));
      }
    }
    return Array.from(dates);
  }, [allDraftRaws]);

  const generateBookingSlots = useCallback(
    (dateKey: string): BookingSlot[] => {
      const bookedStarts = new Set(
        allDraftRaws.filter((s) => s.type === 'BOOKED').map((s) => s.dtstart)
      );
      const nowSec = Math.floor(Date.now() / 1000);
      const result: BookingSlot[] = [];

      for (const slot of allDraftRaws) {
        if (slot.type !== 'ALLOW') continue;

        const occurrences = expandRrule(slot.dtstart, slot.rrule);
        const slotDuration = slot.dtend - slot.dtstart;

        for (const occ of occurrences) {
          if (slot.exdate.includes(occ)) continue;
          if (occ <= nowSec) continue;
          if (dayjs(occ * 1000).format('YYYY-MM-DD') !== dateKey) continue;
          result.push({
            start: new Date(occ * 1000),
            end: new Date((occ + slotDuration) * 1000),
            scheduleId: slot.id,
            isBooked: bookedStarts.has(occ),
          });
        }
      }

      return deduplicateBookingSlots(result);
    },
    [allDraftRaws]
  );

  const addSlotForSelectedDate: UseMentorScheduleReturn['addSlotForSelectedDate'] =
    useCallback(
      ({ startTime, durationMinutes, weeklyWithinMonth }) => {
        if (!selectedDate) return { added: 0, skipped: 0 };
        const res = store.edit(
          0,
          0,
          {
            startTime,
            durationMinutes,
            weeklyWithinMonth,
            selectedDate,
          },
          backend.userId
        );
        return {
          added: res.added ?? 0,
          skipped: res.skipped ?? 0,
        };
      },
      [store, selectedDate, backend.userId]
    );

  const updateDraftSlot: UseMentorScheduleReturn['updateDraftSlot'] =
    useCallback(
      (id, occurrenceUnix, patch) => {
        return store.edit(id, occurrenceUnix, patch, backend.userId);
      },
      [store, backend.userId]
    );

  const deleteDraftSlot: UseMentorScheduleReturn['deleteDraftSlot'] =
    useCallback(
      (id, occurrenceUnix) => {
        store.delete(id, occurrenceUnix);
      },
      [store]
    );

  const confirmChanges = useCallback(async (): Promise<SyncResult> => {
    if (dirtyMonths.size === 0 || !backend.userId) return { ok: true };

    const requests: MonthSyncRequest[] = Array.from(dirtyMonths).map(
      (monthKey) => {
        const { year, month } = parseMonthKey(monthKey);
        const draftRaws = draftByMonth.get(monthKey) ?? [];
        const pendingDeletes = pendingDeleteByMonth.get(monthKey) ?? [];

        const rawUpsert = draftRaws
          .filter((r) => !pendingDeletes.includes(r.id) && r.type === 'ALLOW')
          .map(toServiceSlot);

        // Dedupe by (dtstart, dtend) within this month; queue any persisted
        // duplicate for deletion to avoid PUT conflicts. Mirrors the original
        // single-month behaviour.
        const seenKeys = new Map<string, number>();
        const upsertPayload: TimeSlotDTO[] = [];
        const extraDeleteIds: number[] = [];
        for (const slot of rawUpsert) {
          const key = `${slot.dtstart}_${slot.dtend}`;
          if (!seenKeys.has(key)) {
            seenKeys.set(key, upsertPayload.length);
            upsertPayload.push(slot);
          } else if (typeof slot.id === 'number' && slot.id > 0) {
            extraDeleteIds.push(slot.id);
          }
        }

        return {
          ref: { userId: backend.userId, year, month },
          upsertPayload,
          deleteIds: [...pendingDeletes, ...extraDeleteIds],
        };
      }
    );

    const results = await syncMonths(requests);

    store.commit(results);

    const firstFail = results.find((r) => !r.outcome.ok);
    if (firstFail && !firstFail.outcome.ok) {
      return {
        ok: false,
        reason: firstFail.outcome.reason,
        message: firstFail.outcome.message,
      };
    }
    return { ok: true };
  }, [
    dirtyMonths,
    draftByMonth,
    pendingDeleteByMonth,
    toServiceSlot,
    backend.userId,
    store,
  ]);

  const resetChanges = useCallback(() => {
    if (!backend.userId || dirtyMonths.size === 0) return;
    const monthKeys = Array.from(dirtyMonths);
    (async () => {
      const reloaded = await Promise.all(
        monthKeys.map(async (mk) => {
          const { year, month } = parseMonthKey(mk);
          const raws = await loadMonthScheduleFresh({
            userId: backend.userId,
            year,
            month,
          });
          return [mk, raws] as const;
        })
      );
      store.reset(reloaded);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend.userId, dirtyMonths, store]);

  return {
    loaded,
    monthLoaded,
    isFetching,
    selectedDate,
    setSelectedDate,
    parsedDraft,
    draftForSelectedDate,
    allowedDates,
    generateBookingSlots,
    addSlotForSelectedDate,
    updateDraftSlot,
    deleteDraftSlot,
    confirmChanges,
    resetChanges,
  };
}
