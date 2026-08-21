'use client';

import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(isSameOrBefore);

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { captureFlowFailure } from '@/lib/monitoring';
import { MonthDraftStore } from '@/lib/profile/MonthDraftStore';
import {
  BookingSlot,
  deduplicateBookingSlots,
  expandRrule,
  findMatchedReservation,
  formatTimeslot,
  MonthKey,
  monthKeyFromYearMonth,
  ParsedMentorTimeslot,
  parseMonthKey,
  RawMentorTimeslot,
} from '@/lib/profile/scheduleHelpers';
import { scheduleCache } from '@/services/mentor-schedule/scheduleCache';
import {
  loadMonthScheduleCached,
  loadMonthScheduleFresh,
  prefetchMonthSchedule,
  ScheduleMonthRef,
  syncMonths,
  SyncResult,
} from '@/services/mentor-schedule/sync';
import { fetchReservations } from '@/services/reservations';
import type { Reservation } from '@/types/reservation';

export type {
  BookingSlot,
  ParsedMentorTimeslot,
} from '@/lib/profile/scheduleHelpers';
export { expandRrule } from '@/lib/profile/scheduleHelpers';

// useEffect runs after paint, so on an account switch there's a window where
// the browser can paint one frame of the new userId alongside the previous
// user's still-buffered draft before the cleanup effect fires. useLayoutEffect
// runs before paint, closing that window; it's a no-op during SSR (no DOM to
// mutate before), so fall back to useEffect there to avoid React's dev warning.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

async function fetchAllReservationsForState(
  userId: string,
  state: 'MENTOR_UPCOMING' | 'MENTOR_PENDING',
  endOfMonthUnix: number
): Promise<Reservation[]> {
  let allItems: Reservation[] = [];
  let nextDtend: number | undefined = undefined;
  try {
    while (true) {
      const res = await fetchReservations({
        userId,
        state,
        nextDtend,
        batch: 20,
      });
      allItems = [...allItems, ...res.items];
      if (
        res.items.length === 0 ||
        res.next_dtend === 0 ||
        res.next_dtend >= endOfMonthUnix ||
        res.next_dtend === nextDtend
      ) {
        break;
      }
      nextDtend = res.next_dtend;
    }
  } catch (err) {
    captureFlowFailure({
      flow: 'mentor_schedule_reservations_fetch',
      step: `fetch_${state}`,
      message: err instanceof Error ? err.message : String(err),
    });
    console.error(
      `[useMentorSchedule] Failed to fetch reservations for ${state}:`,
      err
    );
  }
  return allItems;
}

type Options = {
  backend: {
    userId: string;
    year: number;
    month: number; // 1-12
  };
  loginUserId?: string;
};

export type SlotDurationMinutes = 30 | 45 | 60;

export type UpdateDraftSlotResult = {
  success: boolean;
  reason?: 'OVERLAP' | 'TARGET_MONTH_NOT_LOADED' | 'READ_ONLY';
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
  reservations: Reservation[];
};

export function useMentorSchedule(opts: Options): UseMentorScheduleReturn {
  const { backend, loginUserId } = opts;

  // External standalone MonthDraftStore for cross-month states and synchronization logic
  const [store] = useState(
    () => new MonthDraftStore(undefined, { loadMonthScheduleCached })
  );

  const storeState = useSyncExternalStore(
    useCallback((listener) => store.subscribe(listener), [store]),
    useCallback(() => store.snapshot(), [store]),
    useCallback(() => store.snapshot(), [store])
  );

  const { dirtyMonths, allDraftSlots: allDraftRaws } = storeState;

  const [loaded, setLoaded] = useState(false);
  const [monthLoaded, setMonthLoaded] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    dayjs().format('YYYY-MM-DD')
  );

  const [reservations, setReservations] = useState<Reservation[]>([]);

  useEffect(() => {
    if (
      !loginUserId ||
      loginUserId !== backend.userId ||
      !backend.year ||
      !backend.month
    ) {
      setReservations((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    let ignore = false;
    const endOfMonthUnix = dayjs(`${backend.year}-${backend.month}-01`)
      .endOf('month')
      .unix();

    const fetchAll = async () => {
      const [upcoming, pending] = await Promise.all([
        fetchAllReservationsForState(
          loginUserId,
          'MENTOR_UPCOMING',
          endOfMonthUnix
        ),
        fetchAllReservationsForState(
          loginUserId,
          'MENTOR_PENDING',
          endOfMonthUnix
        ),
      ]);
      if (ignore) return;
      setReservations((prev) =>
        prev.length === 0 && upcoming.length === 0 && pending.length === 0
          ? prev
          : [...upcoming, ...pending]
      );
    };

    fetchAll();

    return () => {
      ignore = true;
    };
  }, [loginUserId, backend.userId, backend.year, backend.month]);

  const currentMonthKey = monthKeyFromYearMonth(backend.year, backend.month);

  // Mirror dirtyMonths into a ref so the load effect's per-month dirty guard
  // sees the latest value without re-subscribing.
  const dirtyMonthsRef = useRef<Set<MonthKey>>(dirtyMonths);
  useEffect(() => {
    dirtyMonthsRef.current = dirtyMonths;
  }, [dirtyMonths]);

  // Drop everything when the backend user changes — buffers belong to a
  // specific user. prevUserIdRef is only ever written post-commit (inside
  // the layout effect below), never during render — writing a ref during
  // render is unsafe under Concurrent Mode, since a render React later
  // discards would still have mutated it. In-flight async work in
  // confirmChanges/resetChanges reads this ref after its await to detect an
  // account switch that happened mid-flight, so a stale response for the
  // old user never overwrites the store the new user is looking at.
  const prevUserIdRef = useRef<string | null>(null);
  useIsomorphicLayoutEffect(() => {
    if (
      prevUserIdRef.current !== null &&
      prevUserIdRef.current !== backend.userId
    ) {
      scheduleCache.clear();
      store.clearAll();
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

    // Read the store directly rather than the destructured `draftByMonth`
    // from this render: when backend.userId just changed, the account-switch
    // effect above already ran store.clearAll() this same commit, but the
    // closure here still holds the previous render's (pre-clear) snapshot —
    // stale enough to misreport a same-named month as already buffered and
    // skip fetching the new user's schedule.
    const hasBuffer = store.snapshot().draftByMonth.has(monthKey);
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

          const slotStart = occ;
          const slotEnd = occ + slotDuration;
          const matchedRes = findMatchedReservation(
            reservations,
            slotStart,
            slotEnd
          );

          result.push({
            start: new Date(occ * 1000),
            end: new Date((occ + slotDuration) * 1000),
            scheduleId: slot.id,
            isBooked: bookedStarts.has(occ),
            menteeName: matchedRes?.name,
          });
        }
      }

      return deduplicateBookingSlots(result);
    },
    [allDraftRaws, reservations]
  );

  const addSlotForSelectedDate: UseMentorScheduleReturn['addSlotForSelectedDate'] =
    useCallback(
      ({ startTime, durationMinutes, weeklyWithinMonth }) => {
        if (!selectedDate) return { added: 0, skipped: 0 };
        const res = store.add({
          startTime,
          durationMinutes,
          weeklyWithinMonth,
          selectedDate,
        });
        return {
          added: res.added,
          skipped: res.skipped,
        };
      },
      [store, selectedDate]
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

    const requests = store.getSyncRequests(backend.userId);

    const userIdAtStart = backend.userId;
    const results = await syncMonths(requests);

    // The user may have switched accounts while syncMonths was in flight
    // (which resets the store to the new user's empty buffers). Skip only
    // the commit in that case — writing the old user's results into that
    // store would corrupt it — but still report the real outcome below so a
    // genuine save failure isn't swallowed as a false success.
    if (prevUserIdRef.current === userIdAtStart) {
      store.commit(results);
    }

    const firstFail = results.find((r) => !r.outcome.ok);
    if (firstFail && !firstFail.outcome.ok) {
      return {
        ok: false,
        reason: firstFail.outcome.reason,
        message: firstFail.outcome.message,
      };
    }
    return { ok: true };
  }, [dirtyMonths, backend.userId, store]);

  const resetChanges = useCallback(() => {
    if (!backend.userId || dirtyMonths.size === 0) return;
    const monthKeys = Array.from(dirtyMonths);
    const userIdAtStart = backend.userId;
    // Captured synchronously, before the await below, so a fast
    // A -> B -> A account switch during the refetch can't read this back
    // as B's (or an intervening clearAll's empty) savedByMonth — only to
    // find prevUserIdRef back at A and wrongly treat that empty state as
    // "A has no saved data" once the catch fallback runs.
    const originalSaved = new Map(store.snapshot().savedByMonth);
    (async () => {
      try {
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
        // The user may have switched accounts while the refetch was in
        // flight (which resets the store to the new user's empty buffers).
        // Writing the old user's reloaded months now would corrupt it.
        if (prevUserIdRef.current !== userIdAtStart) return;
        store.reset(reloaded);
      } catch (err) {
        captureFlowFailure({
          flow: 'mentor_schedule_reset',
          step: 'reload_month_schedule',
          message: err instanceof Error ? err.message : String(err),
          level: 'warning',
        });
        if (prevUserIdRef.current !== userIdAtStart) return;
        // Refetch failed: fall back to the pre-await saved snapshot for
        // each dirty month so the draft still clears instead of leaving the
        // UI stuck showing unsaved edits with no way to discard them.
        const fallback = monthKeys.map(
          (mk) => [mk, originalSaved.get(mk) ?? []] as const
        );
        store.reset(fallback);
      }
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
    reservations,
  };
}
