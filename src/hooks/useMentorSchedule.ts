'use client';

import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(isSameOrBefore);

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  BookedSlot,
  deleteMentorSchedule,
  fetchMentorSchedule,
  saveMentorSchedule,
  ScheduleTimeSlots,
  UpsertTimeslotBackend,
} from '@/services/mentor-schedule/schedule';

export type RawMentorTimeslot = {
  id: number; // negative ids are used as temporary local ids for new slots (-1, -2, ...)
  type: 'ALLOW' | 'BLOCK';
  dtstart: number; // unix seconds
  dtend: number; // unix seconds
  rrule?: string; // required by the backend; defaults to empty string for new slots
};

export type ParsedMentorTimeslot = {
  id: number;
  type: 'ALLOW' | 'BLOCK';
  start: Date;
  end: Date;
  durationMinutes: number;
  formatted: string;
  dateKey: string; // YYYY-MM-DD (local)
};

export type BookingSlot = {
  start: Date;
  end: Date;
  scheduleId: number; // parent ALLOW slot id
};

type Options = {
  storageKey?: string;
  seed?: RawMentorTimeslot[];
  mode?: 'local' | 'backend';
  backend?: {
    userId: string;
    year: number;
    month: number; // 1-12
  };
  debug?: boolean;
};

export type UseMentorScheduleReturn = {
  loaded: boolean;
  dirty: boolean;
  selectedDate: string | null;
  setSelectedDate: (dateStr: string | null) => void;

  parsedDraft: ParsedMentorTimeslot[];
  draftForSelectedDate: ParsedMentorTimeslot[];

  meetingDurationMinutes: number;
  setMeetingDuration: (minutes: number) => void;
  generateBookingSlots: (dateKey: string) => BookingSlot[];

  addSlotForSelectedDate: (opts: {
    type: 'ALLOW' | 'BLOCK';
    startTime: string; // HH:mm
    endTime: string; // HH:mm
  }) => void;

  /** Update a slot in the draft without persisting — changes are sent only when the user confirms. */
  updateDraftSlot: (
    id: number,
    patch: {
      type?: 'ALLOW' | 'BLOCK';
      startTime?: string; // HH:mm
      endTime?: string; // HH:mm
    }
  ) => void;

  deleteDraftSlot: (id: number) => void;

  confirmChanges: () => void;
  resetChanges: () => void;
};

const format = (r: RawMentorTimeslot): ParsedMentorTimeslot => {
  const start = new Date(r.dtstart * 1000);
  const end = new Date(r.dtend * 1000);
  const durationMinutes = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60)
  );
  const dateKey = dayjs(start).format('YYYY-MM-DD');
  return {
    id: r.id,
    type: r.type,
    start,
    end,
    durationMinutes,
    formatted: `${dayjs(start).format('YYYY-MM-DD hh:mm A')} ~ ${dayjs(end).format('hh:mm A')}`,
    dateKey,
  };
};

const readFromStorage = (key: string): RawMentorTimeslot[] | null => {
  try {
    const str = localStorage.getItem(key);
    return str ? (JSON.parse(str) as RawMentorTimeslot[]) : null;
  } catch {
    return null;
  }
};

const writeToStorage = (key: string, data: RawMentorTimeslot[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

const nextTempId = (rows: RawMentorTimeslot[]) => {
  const negatives = rows.filter((r) => r.id < 0).map((r) => r.id);
  return negatives.length ? Math.min(...negatives) - 1 : -1;
};

const backendToRaw = (t: ScheduleTimeSlots): RawMentorTimeslot => {
  const toUnixSec = (v: unknown): number => {
    if (typeof v === 'number') return v > 1e12 ? Math.floor(v / 1000) : v;
    return Math.floor(new Date(v as string | number | Date).getTime() / 1000);
  };
  return {
    id: Number(t.id) || Math.floor(Math.random() * 1e9),
    type: t.dt_type,
    dtstart: toUnixSec(t.dtstart),
    dtend: toUnixSec(t.dtend),
    rrule: t.rrule ?? '',
  };
};

export function useMentorSchedule(opts: Options = {}): UseMentorScheduleReturn {
  const {
    storageKey = 'mentor.timeslots',
    seed = [],
    mode = 'local',
    backend,
    debug = false,
  } = opts;

  const debugRef = useRef(debug);
  debugRef.current = debug;
  const log = useCallback((...args: unknown[]) => {
    if (debugRef.current) console.log('[MentorSchedule]', ...args);
  }, []);

  const [saved, setSaved] = useState<RawMentorTimeslot[]>([]);
  const [draft, setDraft] = useState<RawMentorTimeslot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    dayjs().format('YYYY-MM-DD')
  );

  /** Positive ids removed from the draft, pending actual backend DELETE on confirm */
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[]>([]);

  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);

  const [meetingDurationMinutes, setMeetingDurationMinutes] =
    useState<number>(30);

  const setMeetingDuration = useCallback((minutes: number) => {
    setMeetingDurationMinutes(minutes);
  }, []);

  const persistedIdSet = useMemo(
    () => new Set(saved.filter((s) => s.id > 0).map((s) => s.id)),
    [saved]
  );

  const toServiceSlot = useCallback(
    (r: RawMentorTimeslot): UpsertTimeslotBackend => {
      const slot: UpsertTimeslotBackend = {
        dt_type: r.type,
        dtstart: r.dtstart,
        dtend: r.dtend,
        rrule: r.rrule ?? '',
      };
      if (r.id > 0 && persistedIdSet.has(r.id)) slot.id = r.id;
      return slot;
    },
    [persistedIdSet]
  );

  useEffect(() => {
    let ignore = false;
    (async () => {
      log('init load:', { mode, backend, storageKey });
      if (
        mode === 'backend' &&
        backend?.userId &&
        backend?.year &&
        backend?.month
      ) {
        try {
          const data = await fetchMentorSchedule({
            userId: backend.userId,
            year: backend.year,
            month: backend.month,
          });
          const raws = (data?.timeslots ?? []).map(backendToRaw).filter((r) => {
            const d = dayjs(r.dtstart * 1000);
            return d.year() === backend.year && d.month() + 1 === backend.month;
          });
          if (!ignore) {
            setSaved(raws);
            setDraft(raws);
            setLoaded(true);
            setPendingDeleteIds([]);
            setBookedSlots(data?.booked_slots ?? []);
            if (data?.meeting_duration_minutes) {
              setMeetingDurationMinutes(data.meeting_duration_minutes);
            }
          }
        } catch (e) {
          log('fetchMentorSchedule error:', e);
          if (!ignore) setLoaded(true);
        }
      } else {
        const fromStore = readFromStorage(storageKey);
        const base = fromStore ?? seed ?? [];
        if (!ignore) {
          setSaved(base);
          setDraft(base);
          setLoaded(true);
          setPendingDeleteIds([]);
        }
      }
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, storageKey, backend?.userId, backend?.year, backend?.month]);

  const parsedDraft = useMemo(
    () =>
      draft.map(format).sort((a, b) => a.start.getTime() - b.start.getTime()),
    [draft]
  );

  const draftForSelectedDate = useMemo(
    () =>
      selectedDate
        ? parsedDraft.filter((p) => p.dateKey === selectedDate)
        : parsedDraft,
    [parsedDraft, selectedDate]
  );

  const generateBookingSlots = useCallback(
    (dateKey: string): BookingSlot[] => {
      const allowSlots = parsedDraft.filter(
        (slot) => slot.type === 'ALLOW' && slot.dateKey === dateKey
      );
      const durationMs = meetingDurationMinutes * 60 * 1000;
      const result: BookingSlot[] = [];
      for (const slot of allowSlots) {
        let cursor = slot.start.getTime();
        const slotEnd = slot.end.getTime();
        while (cursor + durationMs <= slotEnd) {
          const subStart = cursor;
          const subEnd = cursor + durationMs;
          const isBooked = bookedSlots.some(
            (b) => subStart < b.dtend * 1000 && subEnd > b.dtstart * 1000
          );
          if (!isBooked) {
            result.push({
              start: new Date(subStart),
              end: new Date(subEnd),
              scheduleId: slot.id,
            });
          }
          cursor += durationMs;
        }
      }
      return result;
    },
    [parsedDraft, meetingDurationMinutes, bookedSlots]
  );

  const dirty = useMemo(
    () =>
      JSON.stringify(saved) !== JSON.stringify(draft) ||
      pendingDeleteIds.length > 0,
    [saved, draft, pendingDeleteIds]
  );

  const addSlotForSelectedDate: UseMentorScheduleReturn['addSlotForSelectedDate'] =
    useCallback(
      ({ type, startTime, endTime }) => {
        if (!selectedDate || !startTime || !endTime) return;

        const buildDT = (dateStr: string, timeStr: string) => {
          const [h, m] = timeStr.split(':').map(Number);
          return dayjs(dateStr)
            .hour(h ?? 0)
            .minute(m ?? 0)
            .second(0)
            .millisecond(0);
        };

        const s = buildDT(selectedDate, startTime);
        const e = buildDT(selectedDate, endTime);
        if (!s.isValid() || !e.isValid() || e.isSameOrBefore(s)) return;

        const newDtstart = Math.floor(s.valueOf() / 1000);
        const newDtend = Math.floor(e.valueOf() / 1000);

        setDraft((prev) => {
          const hasOverlap = prev.some((r) => {
            const rDate = dayjs(r.dtstart * 1000).format('YYYY-MM-DD');
            return (
              rDate === selectedDate &&
              newDtstart < r.dtend &&
              newDtend > r.dtstart
            );
          });
          if (hasOverlap) return prev;

          return [
            ...prev,
            {
              id: nextTempId(prev),
              type,
              dtstart: newDtstart,
              dtend: newDtend,
              rrule: '',
            },
          ];
        });
      },
      [selectedDate]
    );

  const updateDraftSlot: UseMentorScheduleReturn['updateDraftSlot'] =
    useCallback((id, patch) => {
      setDraft((prev) => {
        const target = prev.find((r) => r.id === id);
        if (!target) return prev;

        // Use the slot's own date as base and apply the new time on top
        const baseDate = dayjs(target.dtstart * 1000).format('YYYY-MM-DD');

        const fmtHM = (sec: number) => dayjs(sec * 1000).format('HH:mm');
        const startHM = patch.startTime ?? fmtHM(target.dtstart);
        const endHM = patch.endTime ?? fmtHM(target.dtend);

        const buildDT = (dateStr: string, timeStr: string) => {
          const [h, m] = timeStr.split(':').map(Number);
          return dayjs(dateStr)
            .hour(h ?? 0)
            .minute(m ?? 0)
            .second(0)
            .millisecond(0);
        };

        const s = buildDT(baseDate, startHM);
        const e = buildDT(baseDate, endHM);
        if (!s.isValid() || !e.isValid() || e.isSameOrBefore(s)) {
          return prev;
        }

        const newDtstart = Math.floor(s.valueOf() / 1000);
        const newDtend = Math.floor(e.valueOf() / 1000);
        const hasOverlap = prev.some((r) => {
          if (r.id === id) return false;
          const rDate = dayjs(r.dtstart * 1000).format('YYYY-MM-DD');
          return (
            rDate === baseDate && newDtstart < r.dtend && newDtend > r.dtstart
          );
        });
        if (hasOverlap) {
          return prev;
        }

        const next = prev.map((r) =>
          r.id === id
            ? {
                ...r,
                type: patch.type ?? r.type,
                dtstart: newDtstart,
                dtend: newDtend,
              }
            : r
        );
        return next;
      });
    }, []);

  const deleteDraftSlot = useCallback(
    (id: number) => {
      setDraft((prev) => prev.filter((r) => r.id !== id));
      if (mode === 'backend' && id > 0) {
        setPendingDeleteIds((prev) =>
          prev.includes(id) ? prev : [...prev, id]
        );
      }
    },
    [mode]
  );

  const confirmChanges = useCallback(async () => {
    log('confirmChanges clicked:', { mode, backend, dirty, pendingDeleteIds });
    if (!dirty) return;

    if (mode !== 'backend') {
      // local
      writeToStorage(storageKey, draft);
      setSaved(draft);
      setPendingDeleteIds([]);
      return;
    }

    if (!backend?.userId) {
      log('fallback to local: missing backend.userId');
      writeToStorage(storageKey, draft);
      setSaved(draft);
      setPendingDeleteIds([]);
      return;
    }

    // End of month at 23:59:59
    const endOfMonthUnix = dayjs(
      `${backend.year}-${String(backend.month).padStart(2, '0')}-01`
    )
      .endOf('month')
      .hour(23)
      .minute(59)
      .second(59)
      .millisecond(0)
      .unix();

    // Payload to upsert this round (excluding pending deletes)
    const upsertPayload = draft
      .filter((r) => !pendingDeleteIds.includes(r.id))
      .map(toServiceSlot);

    const idsToDelete = [...pendingDeleteIds];

    // Refetch the current month and sync saved/draft state
    const refetch = async () => {
      const data = await fetchMentorSchedule({
        userId: backend.userId,
        year: backend.year,
        month: backend.month,
      });
      const raws = (data?.timeslots ?? []).map(backendToRaw).filter((r) => {
        const d = dayjs(r.dtstart * 1000);
        return d.year() === backend.year && d.month() + 1 === backend.month;
      });
      setSaved(raws);
      setDraft(raws);
      setPendingDeleteIds([]);
      setBookedSlots(data?.booked_slots ?? []);
      if (data?.meeting_duration_minutes) {
        setMeetingDurationMinutes(data.meeting_duration_minutes);
      }
      log('refetched after confirm:', { count: raws.length, raws });
    };

    const doPut = upsertPayload.length > 0;
    const doDelete = idsToDelete.length > 0;

    try {
      // PUT only
      if (doPut && !doDelete) {
        const ok = await saveMentorSchedule({
          userId: backend.userId,
          until: endOfMonthUnix,
          timeslots: upsertPayload,
          meetingDurationMinutes,
        });
        if (ok) await refetch();
        return;
      }

      // DELETE only
      if (!doPut && doDelete) {
        await Promise.all(
          idsToDelete.map(async (id) => {
            const ok = await deleteMentorSchedule({
              userId: backend.userId,
              scheduleId: id,
            });
            if (!ok) throw new Error(`DELETE failed: ${id}`);
          })
        );
        await refetch();
        return;
      }

      // PUT + DELETE together
      const ok = await saveMentorSchedule({
        userId: backend.userId,
        until: endOfMonthUnix,
        timeslots: upsertPayload,
        meetingDurationMinutes,
      });
      if (!ok) throw new Error('PUT failed');

      await Promise.all(
        idsToDelete.map(async (id) => {
          const okDel = await deleteMentorSchedule({
            userId: backend.userId,
            scheduleId: id,
          });
          if (!okDel) throw new Error(`DELETE failed: ${id}`);
        })
      );

      await refetch();
    } catch (e) {
      console.error('[MentorSchedule] confirm failed:', e);
    }
  }, [
    mode,
    draft,
    storageKey,
    toServiceSlot,
    dirty,
    pendingDeleteIds,
    meetingDurationMinutes,
    log,
    backend,
  ]);

  const resetChanges = useCallback(() => {
    if (
      mode === 'backend' &&
      backend?.userId &&
      backend?.year &&
      backend?.month
    ) {
      (async () => {
        const data = await fetchMentorSchedule({
          userId: backend.userId,
          year: backend.year,
          month: backend.month,
        });
        const raws = (data?.timeslots ?? []).map(backendToRaw).filter((r) => {
          const d = dayjs(r.dtstart * 1000);
          return d.year() === backend.year && d.month() + 1 === backend.month;
        });
        setDraft(raws);
        setSaved(raws);
        setPendingDeleteIds([]);
      })();
    } else {
      setDraft(saved);
      setPendingDeleteIds([]);
    }
  }, [mode, backend?.userId, backend?.year, backend?.month, saved]);

  return {
    loaded,
    dirty,
    selectedDate,
    setSelectedDate,
    parsedDraft,
    draftForSelectedDate,
    meetingDurationMinutes,
    setMeetingDuration,
    generateBookingSlots,
    addSlotForSelectedDate,
    updateDraftSlot,
    deleteDraftSlot,
    confirmChanges,
    resetChanges,
  };
}
