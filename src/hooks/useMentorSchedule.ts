'use client';

import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(isSameOrBefore);

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  BookingSlot,
  buildDateTime,
  buildRrule,
  expandRrule,
  formatTimeslot,
  hasOverlapAt,
  MonthKey,
  monthKeyFromDateStr,
  monthKeyFromYearMonth,
  nextTempId,
  ParsedMentorTimeslot,
  parseMonthKey,
  RawMentorTimeslot,
} from '@/lib/profile/scheduleHelpers';
import { TimeSlotDTO } from '@/services/mentor-schedule/schedule';
import { clearAllScheduleCache } from '@/services/mentor-schedule/scheduleCache';
import {
  loadMonthScheduleCached,
  loadMonthScheduleFresh,
  MonthSyncRequest,
  prefetchMonthSchedule,
  ScheduleMonthRef,
  syncMonths,
  SyncResult,
} from '@/services/mentor-schedule/sync';

export type { BookingSlot } from '@/lib/profile/scheduleHelpers';
export { expandRrule } from '@/lib/profile/scheduleHelpers';

type Options = {
  backend: {
    userId: string;
    year: number;
    month: number; // 1-12
  };
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

  meetingDurationMinutes: number;
  generateBookingSlots: (dateKey: string) => BookingSlot[];

  addSlotForSelectedDate: (opts: {
    type: 'ALLOW';
    startTime: string; // HH:mm
    endTime: string; // HH:mm
  }) => void;

  updateDraftSlot: (
    id: number,
    patch: {
      startTime?: string; // HH:mm
      endTime?: string; // HH:mm
    }
  ) => void;

  deleteDraftSlot: (id: number) => void;

  /** Toggle a single sub-slot occurrence in/out of exdate for an ALLOW slot. */
  toggleOccurrence: (slotId: number, occurrenceDtstart: number) => void;

  confirmChanges: () => Promise<SyncResult>;
  resetChanges: () => void;
};

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
  const [meetingDurationMinutes, setMeetingDurationMinutes] =
    useState<number>(30);

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
      const slot: TimeSlotDTO = {
        user_id: 0,
        dt_type: 'ALLOW',
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
      clearAllScheduleCache();
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
      const firstAllow = raws.find((r) => r.type === 'ALLOW');
      if (firstAllow) {
        const derived = Math.round(
          (firstAllow.dtend - firstAllow.dtstart) / 60
        );
        if (derived > 0) setMeetingDurationMinutes(derived);
      }
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

  const parsedDraft = useMemo(
    () =>
      allDraftRaws
        .map(formatTimeslot)
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [allDraftRaws]
  );

  const draftForSelectedDate = useMemo(
    () =>
      selectedDate
        ? parsedDraft.filter((p) => p.dateKey === selectedDate)
        : parsedDraft,
    [parsedDraft, selectedDate]
  );

  const allowedDates = useMemo(() => {
    const dates = new Set<string>();
    for (const slot of allDraftRaws) {
      if (slot.type !== 'ALLOW') continue;
      const occurrences = expandRrule(slot.dtstart, slot.rrule);
      for (const occ of occurrences) {
        if (slot.exdate.includes(occ)) continue;
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
        const slotDateKey = dayjs(slot.dtstart * 1000).format('YYYY-MM-DD');
        if (slotDateKey !== dateKey) continue;

        const occurrences = expandRrule(slot.dtstart, slot.rrule);
        const slotDuration = slot.dtend - slot.dtstart;

        for (const occ of occurrences) {
          if (slot.exdate.includes(occ)) continue;
          if (occ <= nowSec) continue;
          result.push({
            start: new Date(occ * 1000),
            end: new Date((occ + slotDuration) * 1000),
            scheduleId: slot.id,
            isBooked: bookedStarts.has(occ),
          });
        }
      }

      result.sort((a, b) => a.start.getTime() - b.start.getTime());
      return result;
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
      ({ startTime, endTime }) => {
        if (!selectedDate || !startTime || !endTime) return;

        const s = buildDateTime(selectedDate, startTime);
        const e = buildDateTime(selectedDate, endTime);
        if (!s.isValid() || !e.isValid() || e.isSameOrBefore(s)) return;

        const newDtstart = Math.floor(s.valueOf() / 1000);
        const blockDurationSeconds =
          Math.floor(e.valueOf() / 1000) - newDtstart;
        const slotDurationSeconds = meetingDurationMinutes * 60;
        const newDtend = newDtstart + slotDurationSeconds;

        const monthKey = monthKeyFromDateStr(selectedDate);

        const didMutate = updateMonthDraft(monthKey, (prev) => {
          if (
            hasOverlapAt(
              prev,
              null,
              selectedDate,
              newDtstart,
              blockDurationSeconds
            )
          ) {
            return prev;
          }

          const rrule =
            blockDurationSeconds > slotDurationSeconds
              ? buildRrule(blockDurationSeconds, slotDurationSeconds)
              : undefined;

          return [
            ...prev,
            {
              id: nextTempId(prev),
              type: 'ALLOW' as const,
              dtstart: newDtstart,
              dtend: newDtend,
              rrule,
              exdate: [],
            },
          ];
        });

        if (didMutate) markDirty(monthKey);
      },
      [selectedDate, meetingDurationMinutes, updateMonthDraft, markDirty]
    );

  const updateDraftSlot: UseMentorScheduleReturn['updateDraftSlot'] =
    useCallback(
      (id, patch) => {
        const monthKey = findMonthForSlotId(id);
        if (!monthKey) return;

        const didMutate = updateMonthDraft(monthKey, (prev) => {
          const target = prev.find((r) => r.id === id);
          if (!target) return prev;

          const baseDate = dayjs(target.dtstart * 1000).format('YYYY-MM-DD');
          const fmtHM = (sec: number) => dayjs(sec * 1000).format('HH:mm');
          const startHM = patch.startTime ?? fmtHM(target.dtstart);

          const occs = expandRrule(target.dtstart, target.rrule);
          const lastOcc = occs[occs.length - 1] ?? target.dtstart;
          const endHM =
            patch.endTime ?? fmtHM(lastOcc + (target.dtend - target.dtstart));

          const s = buildDateTime(baseDate, startHM);
          const e = buildDateTime(baseDate, endHM);
          if (!s.isValid() || !e.isValid() || e.isSameOrBefore(s)) return prev;

          const newDtstart = Math.floor(s.valueOf() / 1000);
          const blockDurationSeconds =
            Math.floor(e.valueOf() / 1000) - newDtstart;
          const slotDurationSeconds = target.dtend - target.dtstart;
          const newDtend = newDtstart + slotDurationSeconds;

          if (
            hasOverlapAt(prev, id, baseDate, newDtstart, blockDurationSeconds)
          ) {
            return prev;
          }

          const newRrule =
            blockDurationSeconds > slotDurationSeconds
              ? buildRrule(blockDurationSeconds, slotDurationSeconds)
              : undefined;

          const newBlockEnd = newDtstart + blockDurationSeconds;
          const cleanedExdate = target.exdate.filter(
            (occ) => occ >= newDtstart && occ < newBlockEnd
          );

          return prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  dtstart: newDtstart,
                  dtend: newDtend,
                  rrule: newRrule,
                  exdate: cleanedExdate,
                }
              : r
          );
        });

        if (didMutate) markDirty(monthKey);
      },
      [findMonthForSlotId, updateMonthDraft, markDirty]
    );

  const deleteDraftSlot = useCallback(
    (id: number) => {
      const monthKey = findMonthForSlotId(id);
      if (!monthKey) return;

      updateMonthDraft(monthKey, (prev) => prev.filter((r) => r.id !== id));
      if (id > 0) {
        setPendingDeleteByMonth((prev) => {
          const current = prev.get(monthKey) ?? [];
          if (current.includes(id)) return prev;
          const next = new Map(prev);
          next.set(monthKey, [...current, id]);
          return next;
        });
      }
      markDirty(monthKey);
    },
    [findMonthForSlotId, updateMonthDraft, markDirty]
  );

  const toggleOccurrence = useCallback(
    (slotId: number, occurrenceDtstart: number) => {
      const monthKey = findMonthForSlotId(slotId);
      if (!monthKey) return;

      const didMutate = updateMonthDraft(monthKey, (prev) =>
        prev.map((r) => {
          if (r.id !== slotId || r.type !== 'ALLOW') return r;
          const isExcluded = r.exdate.includes(occurrenceDtstart);
          return {
            ...r,
            exdate: isExcluded
              ? r.exdate.filter((d) => d !== occurrenceDtstart)
              : [...r.exdate, occurrenceDtstart],
          };
        })
      );
      if (didMutate) markDirty(monthKey);
    },
    [findMonthForSlotId, updateMonthDraft, markDirty]
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
        // single-month behaviour from issue #224.
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
    meetingDurationMinutes,
    generateBookingSlots,
    addSlotForSelectedDate,
    updateDraftSlot,
    deleteDraftSlot,
    toggleOccurrence,
    confirmChanges,
    resetChanges,
  };
}
