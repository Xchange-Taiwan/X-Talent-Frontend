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

import { useAsyncRead } from '@/hooks/useAsyncRead';
import type { AsyncReadOptions } from '@/lib/asyncReadManager';
import {
  type ScheduleReadKey,
  scheduleReadModel,
} from '@/lib/mentor-schedule/scheduleReadModel';
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
  monthKeyFromYearMonth,
  parseMonthKey,
  RawMentorTimeslot,
} from '@/lib/profile/scheduleHelpers';
import {
  type FetchReservationsResult,
  MENTOR_SCHEDULE_RESERVATIONS_TTL_MS,
  type ReservationReadKey,
  reservationReadModel,
} from '@/lib/reservation/reservationReadModel';
import {
  loadMonthSchedule,
  loadMonthScheduleFresh,
  prefetchMonthSchedule,
  syncMonths,
  SyncResult,
} from '@/services/mentor-schedule/sync';
import type { ReservationState } from '@/services/reservations';
import { fetchAllReservationsForState } from '@/services/reservations';
import type { Reservation } from '@/types/reservation';

// useEffect runs after paint, so on an account switch there's a window where
// the browser can paint one frame of the new userId alongside the previous
// user's still-buffered draft before the cleanup effect fires. useLayoutEffect
// runs before paint, closing that window; it's a no-op during SSR (no DOM to
// mutate before), so fall back to useEffect there to avoid React's dev warning.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// See MENTOR_SCHEDULE_RESERVATIONS_TTL_MS: this calendar's reservation slots
// can go stale from the other party's action with no local write to catch
// it, so they expire on their own. Hoisted to module scope because
// `useAsyncRead` keeps the options object in a ref - a fresh literal per
// render would be pointless churn.
const RESERVATIONS_READ_OPTIONS: AsyncReadOptions<
  ReservationReadKey,
  FetchReservationsResult
> = { ttlMs: MENTOR_SCHEDULE_RESERVATIONS_TTL_MS };

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

export type UseMentorScheduleReturn = {
  /** Sticky: true once any month has resolved. Use this for first-paint skeletons. */
  loaded: boolean;
  /**
   * Full, unfiltered draft occurrences across all types (ALLOW/BOOKED/
   * PENDING/FORBIDDEN), sorted chronologically. Page-level orchestration
   * only (e.g. auto-selecting the calendar's first available date on load)
   * - not part of either narrow domain interface below, since neither the
   * reader nor the editor needs the *unfiltered* draft.
   */
  parsedDraft: ParsedMentorTimeslot[];
  /**
   * The read-only view a mentee or visitor uses to view a mentor's booking
   * schedule. Always present.
   */
  reader: BookingCalendarReader;
  /**
   * The stateful view a mentor uses to manage and sync their own available
   * slots. Only non-null when `loginUserId` matches `backend.userId` (the
   * viewer is managing their own schedule) - a mentee or visitor never
   * receives this.
   */
  editor: MentorScheduleEditor | null;
};

export function useMentorSchedule(opts: Options): UseMentorScheduleReturn {
  const { backend, loginUserId, includeBookedDates = false } = opts;

  // External standalone MonthDraftStore for cross-month states and
  // synchronization logic. It reads already-cached months straight off the
  // read model (a cross-month edit needs the target month's rows, and can
  // only proceed if they are already there) - never a fetch of its own.
  const [store] = useState(
    () =>
      new MonthDraftStore(undefined, {
        getCachedMonthSchedule: (ref) => scheduleReadModel.get(ref),
      })
  );

  const storeState = useSyncExternalStore(
    useCallback((listener) => store.subscribe(listener), [store]),
    useCallback(() => store.snapshot(), [store]),
    useCallback(() => store.snapshot(), [store])
  );

  const { dirtyMonths, allDraftSlots: allDraftRaws } = storeState;

  const [loaded, setLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    dayjs().format('YYYY-MM-DD')
  );
  // Purely a presentation flag for a *user-triggered* reload (the calendar's
  // retry button, or a quick-reply accept/reject). The read model only reports
  // `isLoading` to the reader that asked for the refresh, and here that is
  // `reloadSchedule` rather than this render - so without this the retry
  // button would leave the error state on screen with no feedback at all
  // until the response landed. It says nothing about staleness or mounting:
  // whose response is allowed to win is entirely the read model's business.
  const [isReloadingSchedule, setIsReloadingSchedule] = useState(false);

  const currentMonthKey = monthKeyFromYearMonth(backend.year, backend.month);

  // The viewer only manages their own schedule when they're logged in as the
  // profile being viewed - a mentee/visitor (loginUserId unset or pointing
  // at someone else) must never receive the editor below.
  const isOwner = !!loginUserId && loginUserId === backend.userId;

  // --------------------------------------------------------------------
  // Month schedule
  // --------------------------------------------------------------------

  // useAsyncRead compares keys by reference to detect a "key changed" edge
  // during render, so this must stay referentially stable across renders
  // when (userId, year, month) hasn't actually changed - hence useMemo
  // rather than a fresh object literal per render.
  const scheduleKey = useMemo<ScheduleReadKey | null>(
    () =>
      backend.userId && backend.year && backend.month
        ? { userId: backend.userId, year: backend.year, month: backend.month }
        : null,
    [backend.userId, backend.year, backend.month]
  );

  const fetchMonthRaws = useCallback(
    async (signal: AbortSignal): Promise<RawMentorTimeslot[]> => {
      // Unreachable in practice: the read model only ever runs this for a
      // key it was subscribed with, and a null key is never subscribed.
      if (!scheduleKey) return [];
      return loadMonthSchedule(scheduleKey, signal);
    },
    [scheduleKey]
  );

  // Cache hits, in-flight de-duplication, cancelling the previous month's
  // request on a swipe, and discarding a response whose account/month is no
  // longer on screen are all MentorScheduleReadModel's job - this hook holds
  // no staleness bookkeeping of its own.
  const scheduleRead = useAsyncRead(
    scheduleReadModel,
    scheduleKey,
    fetchMonthRaws
  );
  const monthRaws = scheduleRead.data;

  const monthLoaded =
    scheduleKey !== null && !scheduleRead.isLoading && !isReloadingSchedule;
  const isFetching = scheduleRead.isLoading || isReloadingSchedule;
  const hasError = !isReloadingSchedule && scheduleRead.error !== null;

  // Mirror whatever the read model published for the viewed month into the
  // draft store. `reloadMonth` (rather than `ensureMonthLoaded`) is correct
  // for both entry points here: for a clean month the two are identical, and
  // for a dirty one the published rows are always genuinely newer than what
  // the draft was based on - the read model only republishes a month after a
  // save, a discard, or an explicit reload - so rebasing the unsaved edits on
  // top of them is exactly what's wanted. The reference check skips the
  // no-op case where the store is already sitting on these very rows (e.g.
  // swiping back to an already-loaded month), which would otherwise churn
  // every downstream memo for nothing.
  useEffect(() => {
    if (monthRaws === null) return;
    if (store.snapshot().savedByMonth.get(currentMonthKey) === monthRaws) {
      return;
    }
    store.reloadMonth(currentMonthKey, monthRaws);
  }, [monthRaws, currentMonthKey, store]);

  // Sticky across month changes: once anything has resolved, first-paint
  // skeletons are done for good (until an account switch resets it below).
  useEffect(() => {
    if (scheduleRead.data !== null || scheduleRead.error !== null) {
      setLoaded(true);
    }
  }, [scheduleRead.data, scheduleRead.error]);

  // --------------------------------------------------------------------
  // Reservations for the viewed month
  // --------------------------------------------------------------------

  // Native Date(year, monthIndex, day) rather than dayjs's string parser:
  // Safari's Date.parse rejects unpadded YYYY-M-DD strings (e.g. '2026-7-01')
  // as Invalid Date, which would make endOfMonthUnix NaN and defeat the
  // `res.next_dtend >= endOfMonthUnix` pagination-loop guard downstream.
  const endOfMonthUnix = useMemo(
    () =>
      backend.year && backend.month
        ? dayjs(new Date(backend.year, backend.month - 1, 1))
            .endOf('month')
            .unix()
        : 0,
    [backend.year, backend.month]
  );

  const reservationsActive = isOwner && !!backend.year && !!backend.month;

  const upcomingKey = useMemo<ReservationReadKey | null>(
    () =>
      reservationsActive && loginUserId
        ? { userId: loginUserId, state: 'MENTOR_UPCOMING', endOfMonthUnix }
        : null,
    [reservationsActive, loginUserId, endOfMonthUnix]
  );
  const pendingKey = useMemo<ReservationReadKey | null>(
    () =>
      reservationsActive && loginUserId
        ? { userId: loginUserId, state: 'MENTOR_PENDING', endOfMonthUnix }
        : null,
    [reservationsActive, loginUserId, endOfMonthUnix]
  );

  const createReservationsFetcher = useCallback(
    (state: ReservationState) => async (): Promise<FetchReservationsResult> => {
      if (!loginUserId) return { items: [], next_dtend: 0 };
      try {
        const items = await fetchAllReservationsForState(
          loginUserId,
          state,
          endOfMonthUnix
        );
        return { items, next_dtend: 0 };
      } catch (err) {
        // fetchAllReservationsForState already swallows its own fetch errors
        // internally (returning whatever it collected before failing, never
        // rejecting), so this only fires for something unexpected -
        // defense-in-depth. Rethrowing keeps the read model's result in the
        // error state, which is what holds `reservationsLoaded` false.
        captureFlowFailure({
          flow: 'mentor_schedule_fetch_reservations',
          step: 'fetch_all_reservations',
          message: err instanceof Error ? err.message : String(err),
          level: 'warning',
        });
        throw err;
      }
    },
    [loginUserId, endOfMonthUnix]
  );

  const fetchUpcoming = useMemo(
    () => createReservationsFetcher('MENTOR_UPCOMING'),
    [createReservationsFetcher]
  );
  const fetchPending = useMemo(
    () => createReservationsFetcher('MENTOR_PENDING'),
    [createReservationsFetcher]
  );

  const upcomingRead = useAsyncRead(
    reservationReadModel,
    upcomingKey,
    fetchUpcoming,
    RESERVATIONS_READ_OPTIONS
  );
  const pendingRead = useAsyncRead(
    reservationReadModel,
    pendingKey,
    fetchPending,
    RESERVATIONS_READ_OPTIONS
  );

  const reservations = useMemo<Reservation[]>(
    () => [
      ...(upcomingRead.data?.items ?? []),
      ...(pendingRead.data?.items ?? []),
    ],
    [upcomingRead.data, pendingRead.data]
  );

  // Tracks the reservations read specifically (separate from monthLoaded,
  // which only reflects the schedule/draft read). A booked slot's `status`
  // comes from the schedule read and can resolve before this one, so a
  // dot/label can show PENDING while `slot.reservation` (matched from
  // `reservations`) is still unset - most visibly right after this hook
  // remounts (e.g. navigating back to the profile page), which restarts both
  // reads from scratch. Callers must gate any "click a booked slot" UI on
  // this flag too, not just monthLoaded, or a fast click in that window can
  // read a PENDING slot with no `reservation` attached yet and misfire
  // whatever fallback that caller has for "no reservation". A failed read
  // deliberately leaves this false rather than "loaded but incomplete".
  const reservationsLoaded =
    upcomingKey === null || pendingKey === null
      ? true
      : upcomingRead.data !== null && pendingRead.data !== null;

  // --------------------------------------------------------------------
  // Account switch
  // --------------------------------------------------------------------

  // Drop everything when the backend user changes - buffers belong to a
  // specific user. prevUserIdRef is only ever written post-commit (inside
  // the layout effect below), never during render - writing a ref during
  // render is unsafe under Concurrent Mode, since a render React later
  // discards would still have mutated it. In-flight async work in
  // confirmChanges/resetChanges reads this ref after its await to detect an
  // account switch that happened mid-flight, so a stale response for the
  // old user never overwrites the draft store the new user is looking at.
  // (The *read* paths need no such check: their keys carry the userId, so a
  // late response can only ever land on the account it belongs to.)
  const prevUserIdRef = useRef<string | null>(null);
  useIsomorphicLayoutEffect(() => {
    if (
      prevUserIdRef.current !== null &&
      prevUserIdRef.current !== backend.userId
    ) {
      scheduleReadModel.clear();
      reservationReadModel.clear();
      store.clearAll();
      setLoaded(false);
    }
    prevUserIdRef.current = backend.userId;
  }, [backend.userId, store]);

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

  // --------------------------------------------------------------------
  // Derived view models
  // --------------------------------------------------------------------

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
  // themselves or which flags travel with its result - see SlotsSnapshot.
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

  // --------------------------------------------------------------------
  // Draft mutations
  // --------------------------------------------------------------------

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
    // the commit in that case - writing the old user's results into that
    // store would corrupt it - but still report the real outcome below so a
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
    // as B's (or an intervening clearAll's empty) savedByMonth - only to
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

  // --------------------------------------------------------------------
  // Reload
  // --------------------------------------------------------------------

  const reloadReservations = useCallback(async () => {
    if (!upcomingKey || !pendingKey || !loginUserId) return;

    // Neither this month's cache entry nor any other surface's is touched by
    // hand here (X-Tracker #651): the write path itself (acceptReservation /
    // rejectOrCancelReservation / createReservation, see
    // invalidateReservationRead) is what invalidates the reads its own
    // mutation actually affects. This reload just re-fetches this hook's own
    // current month unconditionally and re-primes it below - a plain write,
    // not an invalidation - so this view reflects its own mutation
    // immediately instead of waiting out MENTOR_SCHEDULE_RESERVATIONS_TTL_MS.
    // A failed fetch simply leaves whatever was cached before untouched,
    // bounded by that same TTL rather than evicted outright.
    //
    // Each write is addressed by its own (user, state, month) key and cancels
    // whatever fetch was in flight for it, so a slower competing read - the
    // mount read for this very month, say - can neither win the race nor
    // leak into a month or an account the user has since moved on to.
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
      reservationReadModel.set(
        upcomingKey,
        { items: upcoming, next_dtend: 0 },
        MENTOR_SCHEDULE_RESERVATIONS_TTL_MS
      );
      reservationReadModel.set(
        pendingKey,
        { items: pending, next_dtend: 0 },
        MENTOR_SCHEDULE_RESERVATIONS_TTL_MS
      );
    } catch (err) {
      captureFlowFailure({
        flow: 'mentor_schedule_reload_reservations',
        step: 'reload_reservations_for_state',
        message: err instanceof Error ? err.message : String(err),
        level: 'warning',
      });
    }
  }, [upcomingKey, pendingKey, loginUserId, endOfMonthUnix]);

  const reloadSchedule = useCallback(async () => {
    if (!scheduleKey) return;
    setIsReloadingSchedule(true);
    try {
      const published = await scheduleReadModel.refresh(
        scheduleKey,
        fetchMonthRaws
      );
      // `null` means the refresh never published - its month was cleared or
      // overwritten mid-flight (an account switch), so there is no failure to
      // report and nothing the user can act on.
      if (published?.error) {
        captureFlowFailure({
          flow: 'mentor_schedule_reload_schedule',
          step: 'reload_month_schedule_fresh',
          message: published.error,
          level: 'warning',
        });
      }
    } finally {
      setIsReloadingSchedule(false);
    }
  }, [scheduleKey, fetchMonthRaws]);

  const reload = useCallback(async () => {
    if (!scheduleKey) return;
    await Promise.all([reloadReservations(), reloadSchedule()]);
  }, [scheduleKey, reloadReservations, reloadSchedule]);

  // --------------------------------------------------------------------
  // Public interfaces
  // --------------------------------------------------------------------

  const reader: BookingCalendarReader = useMemo(
    () => ({
      selectedDate,
      setSelectedDate,
      allowedDates,
      slotsSnapshot,
      getDayBookingStatus,
      isFetching,
      reload,
      hasError,
    }),
    [
      selectedDate,
      allowedDates,
      slotsSnapshot,
      getDayBookingStatus,
      isFetching,
      reload,
      hasError,
    ]
  );

  // Calendar navigation, month-loaded gating, and reload/error all live on
  // `reader` (always present, above). The mentor managing their own schedule
  // always receives both from this hook, so the editor only adds what's
  // genuinely specific to draft mutation - it never re-declares a member
  // `reader` already owns.
  const editor: MentorScheduleEditor | null = useMemo(() => {
    if (!isOwner) return null;
    return {
      draftForSelectedDate,
      addSlotForSelectedDate,
      updateDraftSlot,
      deleteDraftSlot,
      confirmChanges,
      resetChanges,
      reservations,
    };
  }, [
    isOwner,
    draftForSelectedDate,
    addSlotForSelectedDate,
    updateDraftSlot,
    deleteDraftSlot,
    confirmChanges,
    resetChanges,
    reservations,
  ]);

  return {
    loaded,
    parsedDraft,
    reader,
    editor,
  };
}
