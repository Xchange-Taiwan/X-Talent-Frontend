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
  nextTempId,
  ParsedMentorTimeslot,
  RawMentorTimeslot,
} from '@/lib/profile/scheduleHelpers';
import { TimeSlotDTO } from '@/services/mentor-schedule/schedule';
import { clearAllScheduleCache } from '@/services/mentor-schedule/scheduleCache';
import {
  loadMonthScheduleCached,
  loadMonthScheduleFresh,
  prefetchMonthSchedule,
  syncMonthSchedule,
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

  const [saved, setSaved] = useState<RawMentorTimeslot[]>([]);
  const [draft, setDraft] = useState<RawMentorTimeslot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [monthLoaded, setMonthLoaded] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    dayjs().format('YYYY-MM-DD')
  );
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[]>([]);
  const [meetingDurationMinutes, setMeetingDurationMinutes] =
    useState<number>(30);

  const persistedIdSet = useMemo(
    () => new Set(saved.filter((s) => s.id > 0).map((s) => s.id)),
    [saved]
  );

  const toServiceSlot = useCallback(
    (r: RawMentorTimeslot): TimeSlotDTO => {
      // user_id and timezone are normalized in saveMentorSchedule (path param +
      // hardcoded UTC), so the values supplied here are placeholders.
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

  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      prevUserIdRef.current !== null &&
      prevUserIdRef.current !== backend.userId
    ) {
      clearAllScheduleCache();
    }
    prevUserIdRef.current = backend.userId;
  }, [backend.userId]);

  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!backend.userId || !backend.year || !backend.month) return;
    let ignore = false;

    const apply = (raws: RawMentorTimeslot[]) => {
      setSaved(raws);
      setDraft(raws);
      setLoaded(true);
      setMonthLoaded(true);
      setPendingDeleteIds([]);
      const firstAllow = raws.find((r) => r.type === 'ALLOW');
      if (firstAllow) {
        const derived = Math.round(
          (firstAllow.dtend - firstAllow.dtstart) / 60
        );
        if (derived > 0) setMeetingDurationMinutes(derived);
      }
    };

    const { cached, revalidate } = loadMonthScheduleCached(backend);
    if (cached) {
      apply(cached);
    } else if (!dirtyRef.current) {
      // Cache miss: clear stale month data so the calendar doesn't show
      // last month's allowed dots / time slots while the fetch is in flight.
      // monthLoaded -> false so consumers can distinguish "fetching" from
      // "settled empty"; sticky `loaded` is left untouched.
      setSaved([]);
      setDraft([]);
      setPendingDeleteIds([]);
      setMonthLoaded(false);
      setIsFetching(true);
    }

    revalidate
      .then((raws) => {
        if (ignore) return;
        // Don't clobber unsaved edits when fresh data arrives in the background.
        if (dirtyRef.current) return;
        if (cached && JSON.stringify(cached) === JSON.stringify(raws)) return;
        apply(raws);
      })
      .catch(() => {
        // Treat fetch failure as "settled" so the UI doesn't hang on a
        // skeleton; the user will see the empty state instead.
        if (!ignore && !cached) {
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

  const parsedDraft = useMemo(
    () =>
      draft
        .map(formatTimeslot)
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [draft]
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
    for (const slot of draft) {
      if (slot.type !== 'ALLOW') continue;
      const occurrences = expandRrule(slot.dtstart, slot.rrule);
      for (const occ of occurrences) {
        if (slot.exdate.includes(occ)) continue;
        dates.add(dayjs(occ * 1000).format('YYYY-MM-DD'));
      }
    }
    return Array.from(dates);
  }, [draft]);

  const generateBookingSlots = useCallback(
    (dateKey: string): BookingSlot[] => {
      const bookedStarts = new Set(
        draft.filter((s) => s.type === 'BOOKED').map((s) => s.dtstart)
      );
      const result: BookingSlot[] = [];

      for (const slot of draft) {
        if (slot.type !== 'ALLOW') continue;
        const slotDateKey = dayjs(slot.dtstart * 1000).format('YYYY-MM-DD');
        if (slotDateKey !== dateKey) continue;

        const occurrences = expandRrule(slot.dtstart, slot.rrule);
        const slotDuration = slot.dtend - slot.dtstart;

        for (const occ of occurrences) {
          if (slot.exdate.includes(occ)) continue;
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
    [draft]
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

        setDraft((prev) => {
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
      },
      [selectedDate, meetingDurationMinutes]
    );

  const updateDraftSlot: UseMentorScheduleReturn['updateDraftSlot'] =
    useCallback((id, patch) => {
      setDraft((prev) => {
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
    }, []);

  const deleteDraftSlot = useCallback((id: number) => {
    setDraft((prev) => prev.filter((r) => r.id !== id));
    if (id > 0) {
      setPendingDeleteIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }
  }, []);

  const toggleOccurrence = useCallback(
    (slotId: number, occurrenceDtstart: number) => {
      setDraft((prev) =>
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
    },
    []
  );

  const dirty =
    JSON.stringify(saved) !== JSON.stringify(draft) ||
    pendingDeleteIds.length > 0;

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const confirmChanges = useCallback(async (): Promise<SyncResult> => {
    if (!dirty || !backend.userId) return { ok: true };

    const rawUpsert = draft
      .filter((r) => !pendingDeleteIds.includes(r.id) && r.type === 'ALLOW')
      .map(toServiceSlot);

    // Dedupe by (dtstart, dtend); when two slots collide on the same key,
    // keep the first and queue any persisted duplicate for deletion.
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

    const idsToDelete = [...pendingDeleteIds, ...extraDeleteIds];

    const outcome = await syncMonthSchedule({
      ref: backend,
      upsertPayload,
      deleteIds: idsToDelete,
    });
    // On failure, leave saved/draft alone so the user keeps their unsaved
    // edits and can fix the conflict and retry.
    if (!outcome.ok) {
      return { ok: false, reason: outcome.reason, message: outcome.message };
    }
    setSaved(outcome.raws);
    setDraft(outcome.raws);
    setPendingDeleteIds([]);
    return { ok: true };
  }, [draft, toServiceSlot, dirty, pendingDeleteIds, backend]);

  const resetChanges = useCallback(() => {
    if (!backend.userId || !backend.year || !backend.month) return;
    (async () => {
      const raws = await loadMonthScheduleFresh(backend);
      setDraft(raws);
      setSaved(raws);
      setPendingDeleteIds([]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend.userId, backend.year, backend.month]);

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
