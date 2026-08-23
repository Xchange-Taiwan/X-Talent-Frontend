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
import {
  BookingCalendarReader,
  BookingSlot,
  computeBookingAvailability,
  MentorScheduleEditor,
  ParsedMentorTimeslot,
  SlotsSnapshot,
} from '@/lib/profile/bookingAvailability';
import { MonthDraftStore } from '@/lib/profile/MonthDraftStore';
import {
  formatTimeslot,
  MonthKey,
  monthKeyFromYearMonth,
  parseMonthKey,
  RawMentorTimeslot,
} from '@/lib/profile/scheduleHelpers';
import {
  cacheKey,
  scheduleCache,
} from '@/services/mentor-schedule/scheduleCache';
import {
  loadMonthScheduleCached,
  loadMonthScheduleFresh,
  prefetchMonthSchedule,
  ScheduleMonthRef,
  syncMonths,
  SyncResult,
} from '@/services/mentor-schedule/sync';
import { fetchAllReservationsForState } from '@/services/reservations';
import type { Reservation } from '@/types/reservation';

// useEffect runs after paint, so on an account switch there's a window where
// the browser can paint one frame of the new userId alongside the previous
// user's still-buffered draft before the cleanup effect fires. useLayoutEffect
// runs before paint, closing that window; it's a no-op during SSR (no DOM to
// mutate before), so fall back to useEffect there to avoid React's dev warning.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

type Options = {
  backend: {
    userId: string;
    year: number;
    month: number; // 1-12
  };
  loginUserId?: string;
  /**
   * Include dates whose only occurrences are already BOOKED in
   * `allowedDates`, so the mentor viewing their own profile can still select
   * a fully-booked date to view/manage the reservation. Mentee/visitor
   * callers must leave this false: they share the same `allowedDates` to
   * disable calendar dates, and a fully-booked date has no bookable slot for
   * them to select.
   */
  includeBookedDates?: boolean;
};

export type UpdateDraftSlotResult = {
  success: boolean;
  reason?: 'OVERLAP' | 'TARGET_MONTH_NOT_LOADED' | 'READ_ONLY';
};

export type UseMentorScheduleReturn = {
  /** Sticky: true once any month has resolved. Use this for first-paint skeletons. */
  loaded: boolean;
  /** Per-month: false while the *current* (year, month) is being fetched after a cache miss. */
  monthLoaded: boolean;
  reservationsLoaded: boolean;
  isFetching: boolean;
  selectedDate: string | null;
  setSelectedDate: (dateStr: string | null) => void;

  parsedDraft: ParsedMentorTimeslot[];
  draftForSelectedDate: ParsedMentorTimeslot[];
  /** All local dates (YYYY-MM-DD) that have at least one ALLOW occurrence after expanding rrules. */
  allowedDates: string[];

  slotsSnapshot: SlotsSnapshot;
  getDayBookingStatus: (dateKey: string) => BookingStatus | null;
  reservations: Reservation[];

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

  hasError: boolean;
  reload: () => void | Promise<void>;
};

export function useMentorSchedule(opts: Options): UseMentorScheduleReturn {
  const { backend, loginUserId, includeBookedDates = false } = opts;
  const backendRef = useRef(backend);
  useIsomorphicLayoutEffect(() => {
    backendRef.current = backend;
  }, [backend]);

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

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [loaded, setLoaded] = useState(false);
  const [monthLoaded, setMonthLoaded] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    dayjs().format('YYYY-MM-DD')
  );
  const [hasError, setHasError] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const [reservations, setReservations] = useState<Reservation[]>([]);
  // Tracks the reservations fetch specifically (separate from monthLoaded,
  // which only reflects the schedule/draft fetch). A booked slot's `status`
  // comes from the schedule fetch and can resolve before this one, so a
  // dot/label can show PENDING while `slot.reservation` (matched from
  // `reservations`) is still unset — most visibly right after this hook
  // remounts (e.g. navigating back to the profile page), which restarts both
  // fetches from scratch. Callers must gate any "click a booked slot" UI on
  // this flag too, not just monthLoaded, or a fast click in that window can
  // read a PENDING slot with no `reservation` attached yet and misfire
  // whatever fallback that caller has for "no reservation".
  const [reservationsLoaded, setReservationsLoaded] = useState(false);

  useEffect(() => {
    if (
      !loginUserId ||
      loginUserId !== backend.userId ||
      !backend.year ||
      !backend.month
    ) {
      setReservations((prev) => (prev.length === 0 ? prev : []));
      setReservationsLoaded(true);
      return;
    }

    let ignore = false;
    setReservationsLoaded(false);
    // Native Date(year, monthIndex, day) rather than dayjs's string parser:
    // Safari's Date.parse rejects unpadded YYYY-M-DD strings (e.g. '2026-7-01')
    // as Invalid Date, which would make endOfMonthUnix NaN and defeat the
    // `res.next_dtend >= endOfMonthUnix` pagination-loop guard below.
    const endOfMonthUnix = dayjs(new Date(backend.year, backend.month - 1, 1))
      .endOf('month')
      .unix();

    const fetchAll = async () => {
      try {
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
        // Deliberately set only on this success path, not in a `finally`
        // (finally always runs, catch or no catch, so putting it there
        // would mark reservationsLoaded true even after the catch below —
        // exactly the "loaded but incomplete" state this flag exists to
        // prevent callers from acting on). If this effect never resolves
        // successfully, reservationsLoaded correctly stays false, keeping
        // the "已預約" section on its loading state rather than rendering
        // slots whose `.reservation` was never actually fetched.
        setReservationsLoaded(true);
      } catch (err) {
        // fetchAllReservationsForState already swallows its own fetch
        // errors internally (returning whatever it collected before
        // failing, never rejecting), so this only fires for something
        // unexpected elsewhere in the try block — defense-in-depth,
        // matching reloadReservations' handling below.
        if (ignore) return;
        captureFlowFailure({
          flow: 'mentor_schedule_fetch_reservations',
          step: 'fetch_all_reservations',
          message: err instanceof Error ? err.message : String(err),
          level: 'warning',
        });
      }
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

  const isStale = useCallback(
    (start: { userId: string; year: number; month: number }) => {
      return (
        backendRef.current.userId !== start.userId ||
        backendRef.current.year !== start.year ||
        backendRef.current.month !== start.month ||
        !isMountedRef.current
      );
    },
    []
  );

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
      setHasError(false);
    } else if (cached) {
      apply(cached);
      setLoaded(true);
      setMonthLoaded(true);
      setHasError(false);
    } else {
      // Cache miss + no buffer: skeleton until revalidate lands. monthLoaded
      // -> false so consumers can distinguish "fetching" from "settled empty";
      // sticky `loaded` is left untouched.
      setMonthLoaded(false);
      setIsFetching(true);
      setHasError(false);
    }

    revalidate
      .then((raws) => {
        if (ignore) return;
        if (dirtyMonthsRef.current.has(monthKey)) return;
        if (cached && JSON.stringify(cached) === JSON.stringify(raws)) {
          setLoaded(true);
          setMonthLoaded(true);
          setHasError(false);
          return;
        }
        apply(raws);
        setLoaded(true);
        setMonthLoaded(true);
        setHasError(false);
      })
      .catch(() => {
        // Treat fetch failure as "settled" so the UI doesn't hang on a
        // skeleton; the user will see the empty state instead.
        if (!ignore && !cached && !hasBuffer) {
          setHasError(true);
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
  }, [backend.userId, backend.year, backend.month, store, retryTrigger]);

  // Prefetch the next month after the current month finishes loading, so
  // forward navigation hits cache. Past months are intentionally skipped.
  useEffect(() => {
    if (!loaded || !backend.userId) return;
    const next = dayjs(new Date(backend.year, backend.month - 1, 1)).add(
      1,
      'month'
    );
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

  // Compute booking availability read model using our extracted pure non-React module
  const availabilityModel = useMemo(() => {
    const nowSec = Math.floor(Date.now() / 1000);
    return computeBookingAvailability({
      draftRows: allDraftRaws,
      nowSec,
      includeBookedDates,
    });
  }, [allDraftRaws, includeBookedDates]);

  const { allowedDates, bookingStatusByDate } = availabilityModel;

  const generateBookingSlots = useCallback(
    (dateKey: string): BookingSlot[] => {
      return availabilityModel.generateBookingSlots(dateKey, reservations);
    },
    [availabilityModel, reservations]
  );

  // Bundles the selected date's slots with the two flags that gate whether
  // it's safe to render/interact with them, so callers (e.g. the profile
  // page UI) don't need to know how to call generateBookingSlots
  // themselves or which flags travel with its result — see SlotsSnapshot.
  const slotsSnapshot = useMemo<SlotsSnapshot>(
    () => ({
      slots: selectedDate ? generateBookingSlots(selectedDate) : [],
      monthLoaded,
      reservationsLoaded,
    }),
    [selectedDate, generateBookingSlots, monthLoaded, reservationsLoaded]
  );

  const getDayBookingStatus: BookingCalendarReader['getDayBookingStatus'] =
    useCallback(
      (dateKey: string) => bookingStatusByDate.get(dateKey) ?? null,
      [bookingStatusByDate]
    );

  const addSlotForSelectedDate: MentorScheduleEditor['addSlotForSelectedDate'] =
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

  const updateDraftSlot: MentorScheduleEditor['updateDraftSlot'] = useCallback(
    (id, occurrenceUnix, patch) => {
      return store.edit(id, occurrenceUnix, patch, backend.userId);
    },
    [store, backend.userId]
  );

  const deleteDraftSlot: MentorScheduleEditor['deleteDraftSlot'] = useCallback(
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

  const reloadReservations = useCallback(async () => {
    if (
      !loginUserId ||
      loginUserId !== backend.userId ||
      !backend.year ||
      !backend.month
    ) {
      return;
    }
    const startSnapshot = {
      userId: backend.userId,
      year: backend.year,
      month: backend.month,
    };
    const endOfMonthUnix = dayjs(new Date(backend.year, backend.month - 1, 1))
      .endOf('month')
      .unix();

    try {
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
      if (isStale(startSnapshot)) return;
      setReservations([...upcoming, ...pending]);
    } catch (err) {
      if (isStale(startSnapshot)) return;
      captureFlowFailure({
        flow: 'mentor_schedule_reload_reservations',
        step: 'reload_reservations_for_state',
        message: err instanceof Error ? err.message : String(err),
        level: 'warning',
      });
    }
  }, [loginUserId, backend.userId, backend.year, backend.month, isStale]);

  const reloadSchedule = useCallback(async () => {
    if (!backend.userId || !backend.year || !backend.month) return;
    const startSnapshot = {
      userId: backend.userId,
      year: backend.year,
      month: backend.month,
    };
    const monthKey = currentMonthKey;
    try {
      const raws = await loadMonthScheduleFresh({
        userId: backend.userId,
        year: backend.year,
        month: backend.month,
      });
      if (isStale(startSnapshot)) return;
      store.reloadMonth(monthKey, raws);
    } catch (err) {
      if (isStale(startSnapshot)) return;
      captureFlowFailure({
        flow: 'mentor_schedule_reload_schedule',
        step: 'reload_month_schedule_fresh',
        message: err instanceof Error ? err.message : String(err),
        level: 'warning',
      });
    }
  }, [
    backend.userId,
    backend.year,
    backend.month,
    currentMonthKey,
    store,
    isStale,
  ]);

  const reload = useCallback(async () => {
    if (!backend.userId || !backend.year || !backend.month) return;
    const key = cacheKey({
      userId: backend.userId,
      year: backend.year,
      month: backend.month,
    });
    scheduleCache.delete(key);
    setRetryTrigger((prev) => prev + 1);
    await Promise.all([reloadReservations(), reloadSchedule()]);
  }, [backend.userId, backend.year, backend.month, reloadReservations, reloadSchedule]);

  return {
    loaded,
    monthLoaded,
    reservationsLoaded,
    isFetching,
    selectedDate,
    setSelectedDate,
    parsedDraft,
    draftForSelectedDate,
    allowedDates,
    slotsSnapshot,
    getDayBookingStatus,
    addSlotForSelectedDate,
    updateDraftSlot,
    deleteDraftSlot,
    confirmChanges,
    resetChanges,
    hasError,
    reservations,
    reload,
  };
}
