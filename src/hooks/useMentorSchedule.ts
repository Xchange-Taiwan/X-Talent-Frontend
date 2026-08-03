'use client';

import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(isSameOrBefore);

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  activeOccurrences,
  BookingSlot,
  buildDateTime,
  expandRrule,
  findRestorableExdatedRow,
  formatTimeslot,
  hasAnyOccurrenceOverlap,
  MonthKey,
  monthKeyFromDateStr,
  monthKeyFromUnix,
  monthKeyFromYearMonth,
  nextTempId,
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

const appendExdate = (exdates: number[], unix: number): number[] =>
  exdates.includes(unix) ? exdates : [...exdates, unix];

function ensureTargetMonthLoaded({
  targetMonthKey,
  currentDraftsMap,
  userId,
}: {
  targetMonthKey: MonthKey;
  currentDraftsMap: Map<MonthKey, RawMentorTimeslot[]>;
  userId: string;
}): RawMentorTimeslot[] | null {
  let targetDraft = currentDraftsMap.get(targetMonthKey);
  if (!targetDraft) {
    const { year, month } = parseMonthKey(targetMonthKey);
    const { cached } = loadMonthScheduleCached({
      userId,
      year,
      month,
    });
    if (!cached) {
      return null;
    }
    targetDraft = cached;
  }
  return targetDraft;
}

function checkCrossMonthOverlap({
  id,
  occurrenceUnix,
  newDtstart,
  durationSeconds,
  isRecurring,
  currentDraftsMap,
  targetDraft,
}: {
  id: number;
  occurrenceUnix: number;
  newDtstart: number;
  durationSeconds: number;
  isRecurring: boolean;
  currentDraftsMap: Map<MonthKey, RawMentorTimeslot[]>;
  targetDraft: RawMentorTimeslot[];
}): boolean {
  const draftsToCheck = Array.from(currentDraftsMap.values()).flat();
  const isTargetLoaded = currentDraftsMap.has(monthKeyFromUnix(newDtstart));
  if (!isTargetLoaded) {
    draftsToCheck.push(...targetDraft);
  }

  let intermediateDraftsToCheck = draftsToCheck;
  if (isRecurring) {
    // If recurring, we simulate exdating the parent row
    intermediateDraftsToCheck = draftsToCheck.map((r: RawMentorTimeslot) =>
      r.id === id
        ? {
            ...r,
            exdate: appendExdate(r.exdate, occurrenceUnix),
          }
        : r
    );
  }

  // Run unified overlap check
  return hasAnyOccurrenceOverlap(
    intermediateDraftsToCheck,
    isRecurring ? null : id, // ignore current row ID only if it is non-recurring
    [newDtstart],
    durationSeconds
  );
}

export function useMentorSchedule(opts: Options): UseMentorScheduleReturn {
  const { backend } = opts;

  // Per-month buffers. Editing a slot only mutates that slot's month entry;
  // unloaded months stay absent from these maps until the user navigates to
  // them. Slot ids issued by the backend are globally unique so the same id
  // never appears in two month buffers.
  const [savedByMonth, setSavedByMonth] = useState<
    Map<MonthKey, RawMentorTimeslot[]>
  >(() => new Map());
  const [draftByMonth, setDraftByMonth] = useState<
    Map<MonthKey, RawMentorTimeslot[]>
  >(() => new Map());
  const [pendingDeleteByMonth, setPendingDeleteByMonth] = useState<
    Map<MonthKey, number[]>
  >(() => new Map());
  const [dirtyMonths, setDirtyMonths] = useState<Set<MonthKey>>(
    () => new Set()
  );

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
      setSavedByMonth(new Map());
      setDraftByMonth(new Map());
      setPendingDeleteByMonth(new Map());
      setDirtyMonths(new Set());
      setLoaded(false);
    }
    prevUserIdRef.current = backend.userId;
  }, [backend.userId]);

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
      if (dirtyMonthsRef.current.has(monthKey)) return;
      setSavedByMonth((prev) => {
        const next = new Map(prev);
        next.set(monthKey, raws);
        return next;
      });
      setDraftByMonth((prev) => {
        const next = new Map(prev);
        next.set(monthKey, raws);
        return next;
      });
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
  }, [backend.userId, backend.year, backend.month]);

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
    return out;
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

      // Deduplicate slots with the same start time, merging isBooked status
      const uniqueMap = new Map<number, BookingSlot>();
      for (const item of result) {
        const key = item.start.getTime();
        const existing = uniqueMap.get(key);
        if (existing) {
          existing.isBooked = existing.isBooked || item.isBooked;
        } else {
          uniqueMap.set(key, { ...item });
        }
      }

      const uniqueResult = Array.from(uniqueMap.values());
      uniqueResult.sort((a, b) => a.start.getTime() - b.start.getTime());
      return uniqueResult;
    },
    [allDraftRaws]
  );

  const updateMonthDraft = useCallback(
    (
      monthKey: MonthKey,
      updater: (prev: RawMentorTimeslot[]) => RawMentorTimeslot[]
    ): boolean => {
      let changed = false;
      setDraftByMonth((prev) => {
        const current = prev.get(monthKey) ?? [];
        const next = updater(current);
        if (next === current) return prev;
        changed = true;
        const out = new Map(prev);
        out.set(monthKey, next);
        return out;
      });
      return changed;
    },
    []
  );

  const markDirty = useCallback((monthKey: MonthKey) => {
    setDirtyMonths((prev) => {
      if (prev.has(monthKey)) return prev;
      const next = new Set(prev);
      next.add(monthKey);
      return next;
    });
  }, []);

  // Slots are scoped to a specific month buffer; when the dialog calls a
  // mutator with just an id we recover the owning month by scanning all
  // loaded buffers (cheap — a mentor rarely buffers more than a few months
  // per session).
  const findMonthForSlotId = useCallback(
    (id: number): MonthKey | null => {
      let result: MonthKey | null = null;
      draftByMonth.forEach((raws, key) => {
        if (result !== null) return;
        if (raws.some((r) => r.id === id)) result = key;
      });
      return result;
    },
    [draftByMonth]
  );

  const addSlotForSelectedDate: UseMentorScheduleReturn['addSlotForSelectedDate'] =
    useCallback(
      ({ startTime, durationMinutes, weeklyWithinMonth }) => {
        if (!selectedDate || !startTime) return { added: 0, skipped: 0 };

        const startDayjs = buildDateTime(selectedDate, startTime);
        if (!startDayjs.isValid()) return { added: 0, skipped: 0 };

        const monthKey = monthKeyFromDateStr(selectedDate);
        const durationSeconds = durationMinutes * 60;

        // Walk same-weekday dates from selectedDate to month-end. The first
        // entry is always the selected date itself; subsequent entries exist
        // only when weeklyWithinMonth is true.
        const candidateOccurrences: number[] = [];
        if (weeklyWithinMonth) {
          const selectedDay = dayjs(selectedDate);
          let cursor = selectedDay;
          while (cursor.month() === selectedDay.month()) {
            const d = buildDateTime(cursor.format('YYYY-MM-DD'), startTime);
            if (d.isValid()) {
              candidateOccurrences.push(Math.floor(d.valueOf() / 1000));
            }
            cursor = cursor.add(7, 'day');
          }
        } else {
          candidateOccurrences.push(Math.floor(startDayjs.valueOf() / 1000));
        }

        if (candidateOccurrences.length === 0) {
          return { added: 0, skipped: 0 };
        }

        let added = 0;
        let skipped = 0;
        updateMonthDraft(monthKey, (prev) => {
          // Reject the whole entry if any candidate occurrence overlaps an
          // existing slot. This keeps weekly add atomic — we don't silently
          // create a partial recurrence.
          if (
            hasAnyOccurrenceOverlap(
              prev,
              null,
              candidateOccurrences,
              durationSeconds
            )
          ) {
            skipped = candidateOccurrences.length;
            return prev;
          }

          // Re-adding a single, previously-deleted occurrence of a still
          // -recurring slot restores it (undoes the exdate) instead of
          // creating a duplicate row at the same time.
          if (candidateOccurrences.length === 1) {
            const restoreTarget = findRestorableExdatedRow(
              prev,
              candidateOccurrences[0],
              durationSeconds
            );
            if (restoreTarget) {
              added = 1;
              return prev.map((r) =>
                r.id === restoreTarget.id
                  ? {
                      ...r,
                      exdate: r.exdate.filter(
                        (x) => x !== candidateOccurrences[0]
                      ),
                    }
                  : r
              );
            }
          }

          const dtstart = candidateOccurrences[0];
          const count = candidateOccurrences.length;
          const rrule = count > 1 ? `FREQ=WEEKLY;COUNT=${count}` : undefined;

          added = count;
          return [
            ...prev,
            {
              id: nextTempId(prev),
              type: 'ALLOW' as const,
              dtstart,
              dtend: dtstart + durationSeconds,
              rrule,
              exdate: [],
            },
          ];
        });

        if (added > 0) markDirty(monthKey);
        return { added, skipped };
      },
      [selectedDate, updateMonthDraft, markDirty]
    );

  const updateDraftSlot: UseMentorScheduleReturn['updateDraftSlot'] =
    useCallback(
      (id, occurrenceUnix, patch) => {
        const parentMonthKey = findMonthForSlotId(id);
        if (!parentMonthKey) return { success: false };

        // Fetch parentDraft outside state setter
        const currentDraftsMap = draftByMonth;
        const parentDraft = currentDraftsMap.get(parentMonthKey) ?? [];
        const target = parentDraft.find((r) => r.id === id);
        if (!target) return { success: false };

        // Date math computed once outside of updater function
        const baseDate = dayjs(occurrenceUnix * 1000).format('YYYY-MM-DD');
        const fmtHM = (sec: number) => dayjs(sec * 1000).format('HH:mm');
        const startHM = patch.startTime ?? fmtHM(occurrenceUnix);

        const s = buildDateTime(baseDate, startHM);
        if (!s.isValid()) return { success: false };

        const newDtstart = Math.floor(s.valueOf() / 1000);
        const oldDurationSeconds = target.dtend - target.dtstart;
        const durationSeconds =
          (patch.durationMinutes ?? Math.round(oldDurationSeconds / 60)) * 60;

        const isRecurring = !!target.rrule;
        const noChange =
          newDtstart === occurrenceUnix &&
          durationSeconds === oldDurationSeconds;

        if (noChange) {
          return { success: true };
        }

        const targetMonthKey = monthKeyFromUnix(newDtstart);

        // Fetch / ensure target draft is loaded/cached outside state setter from ref
        const targetDraft = ensureTargetMonthLoaded({
          targetMonthKey,
          currentDraftsMap,
          userId: backend.userId,
        });
        if (!targetDraft) {
          return { success: false, reason: 'TARGET_MONTH_NOT_LOADED' };
        }
        const isTargetLoaded = currentDraftsMap.has(targetMonthKey);

        // Run unified overlap check
        const hasOverlap = checkCrossMonthOverlap({
          id,
          occurrenceUnix,
          newDtstart,
          durationSeconds,
          isRecurring,
          currentDraftsMap,
          targetDraft,
        });
        if (hasOverlap) {
          return { success: false, reason: 'OVERLAP' };
        }

        // Side-effect: update savedByMonth outside updater if initializing target month
        if (!isTargetLoaded) {
          setSavedByMonth((prevSaved) => {
            const nextSaved = new Map(prevSaved);
            nextSaved.set(targetMonthKey, targetDraft!);
            return nextSaved;
          });
        }

        // Now run the pure state transformation on draftByMonth
        setDraftByMonth((prevDraft) => {
          const nextDraft = new Map(prevDraft);

          // Lazy initialize target month in draft Map if not yet loaded
          if (!nextDraft.has(targetMonthKey)) {
            nextDraft.set(targetMonthKey, targetDraft!);
          }

          const currentParentDraft = nextDraft.get(parentMonthKey) ?? [];
          const currentTargetDraft = nextDraft.get(targetMonthKey) ?? [];

          // Solve stale closure by querying the latest target state from currentParentDraft
          const latestTarget = currentParentDraft.find((r) => r.id === id);
          if (!latestTarget) return prevDraft;

          if (isRecurring) {
            const updatedParent: RawMentorTimeslot = {
              ...latestTarget,
              exdate: appendExdate(latestTarget.exdate, occurrenceUnix),
            };
            const detachedRow: RawMentorTimeslot = {
              id: nextTempId(Array.from(nextDraft.values()).flat()),
              type: 'ALLOW' as const,
              dtstart: newDtstart,
              dtend: newDtstart + durationSeconds,
              rrule: undefined,
              exdate: [],
            };

            // Recursively update parent row's exdate across ALL loaded month buffers (Correctness Finding 1)
            nextDraft.forEach((mDraft, mKey) => {
              if (mDraft.some((r: RawMentorTimeslot) => r.id === id)) {
                nextDraft.set(
                  mKey,
                  mDraft.map((r: RawMentorTimeslot) =>
                    r.id === id ? updatedParent : r
                  )
                );
              }
            });

            // Append the new detached row to the target month buffer
            const updatedTargetDraft = nextDraft.get(targetMonthKey) ?? [];
            nextDraft.set(targetMonthKey, [...updatedTargetDraft, detachedRow]);
          } else {
            // Non-recurring slot
            const updatedSlot: RawMentorTimeslot = {
              ...latestTarget,
              dtstart: newDtstart,
              dtend: newDtstart + durationSeconds,
              rrule: undefined,
              exdate: [],
            };

            if (targetMonthKey === parentMonthKey) {
              nextDraft.set(
                parentMonthKey,
                currentParentDraft.map((r) => (r.id === id ? updatedSlot : r))
              );
            } else {
              // Remove from parent draft and add to target draft
              nextDraft.set(
                parentMonthKey,
                currentParentDraft.filter((r) => r.id !== id)
              );
              nextDraft.set(targetMonthKey, [
                ...currentTargetDraft,
                updatedSlot,
              ]);
            }
          }

          return nextDraft;
        });

        // Mark all months containing this parent row (and target month) dirty to sync exdates (Correctness Finding 1)
        currentDraftsMap.forEach((mDraft, mKey) => {
          if (mDraft.some((r: RawMentorTimeslot) => r.id === id)) {
            markDirty(mKey);
          }
        });
        markDirty(targetMonthKey);

        return { success: true };
      },
      [findMonthForSlotId, markDirty, backend.userId, draftByMonth]
    );

  const deleteDraftSlot = useCallback(
    (id: number, occurrenceUnix: number) => {
      const parentMonthKey = findMonthForSlotId(id);
      if (!parentMonthKey) return;

      let fullyRemovedFromSomeMonth = false;

      setDraftByMonth((prevDraft) => {
        const nextDraft = new Map(prevDraft);

        const parentDraft = nextDraft.get(parentMonthKey) ?? [];
        const target = parentDraft.find((r) => r.id === id);
        if (!target) return prevDraft;

        if (target.rrule) {
          const updatedExdate = target.exdate.includes(occurrenceUnix)
            ? target.exdate
            : [...target.exdate, occurrenceUnix];
          const updatedParent: RawMentorTimeslot = {
            ...target,
            exdate: updatedExdate,
          };

          const isFullyEmpty = activeOccurrences(updatedParent).length === 0;

          // Recursively update or remove parent row across ALL loaded month buffers (Correctness Finding 1)
          nextDraft.forEach((mDraft, mKey) => {
            if (mDraft.some((r: RawMentorTimeslot) => r.id === id)) {
              if (isFullyEmpty) {
                fullyRemovedFromSomeMonth = true;
                nextDraft.set(
                  mKey,
                  mDraft.filter((r: RawMentorTimeslot) => r.id !== id)
                );
              } else {
                nextDraft.set(
                  mKey,
                  mDraft.map((r: RawMentorTimeslot) =>
                    r.id === id ? updatedParent : r
                  )
                );
              }
            }
          });
        } else {
          fullyRemovedFromSomeMonth = true;
          // Non-recurring slot: remove entirely from parent draft
          nextDraft.set(
            parentMonthKey,
            parentDraft.filter((r: RawMentorTimeslot) => r.id !== id)
          );
        }

        return nextDraft;
      });

      // Only persisted rows that were fully removed need a backend DELETE.
      // Detached/exdated rrule rows ride the next save via rrule + exdate.
      if (fullyRemovedFromSomeMonth && id > 0) {
        setPendingDeleteByMonth((prev) => {
          const current = prev.get(parentMonthKey) ?? [];
          if (current.includes(id)) return prev;
          const next = new Map(prev);
          next.set(parentMonthKey, [...current, id]);
          return next;
        });
      }

      // Mark all months that contain this parent row as dirty (so exdates are synchronized on save)
      const currentDraftsMap = draftByMonth;
      currentDraftsMap.forEach((mDraft, mKey) => {
        if (mDraft.some((r: RawMentorTimeslot) => r.id === id)) {
          markDirty(mKey);
        }
      });
    },
    [findMonthForSlotId, markDirty, draftByMonth]
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

    // Update buffers for every month that succeeded; leave failed months in
    // place so the user can retry without losing edits.
    setSavedByMonth((prev) => {
      const next = new Map(prev);
      for (const r of results)
        if (r.outcome.ok) next.set(r.monthKey, r.outcome.raws);
      return next;
    });
    setDraftByMonth((prev) => {
      const next = new Map(prev);
      for (const r of results)
        if (r.outcome.ok) next.set(r.monthKey, r.outcome.raws);
      return next;
    });
    setPendingDeleteByMonth((prev) => {
      const next = new Map(prev);
      for (const r of results) if (r.outcome.ok) next.delete(r.monthKey);
      return next;
    });
    setDirtyMonths((prev) => {
      const next = new Set(prev);
      for (const r of results) if (r.outcome.ok) next.delete(r.monthKey);
      return next;
    });

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
      setSavedByMonth((prev) => {
        const next = new Map(prev);
        for (const [mk, raws] of reloaded) next.set(mk, raws);
        return next;
      });
      setDraftByMonth((prev) => {
        const next = new Map(prev);
        for (const [mk, raws] of reloaded) next.set(mk, raws);
        return next;
      });
      setPendingDeleteByMonth((prev) => {
        const next = new Map(prev);
        for (const [mk] of reloaded) next.delete(mk);
        return next;
      });
      setDirtyMonths(new Set());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend.userId, dirtyMonths]);

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
