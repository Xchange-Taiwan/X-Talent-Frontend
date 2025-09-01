'use client';

import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(isSameOrBefore);

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  fetchMentorSchedule,
  saveMentorSchedule,
  ScheduleTimeSlots,
  UpsertTimeslotBackend,
} from '@/services/mentorSchedule/schedule';

export type RawMentorTimeslot = {
  id: number; // 新增用負數暫存 id（-1, -2, ...）
  type: 'ALLOW' | 'BLOCK';
  dtstart: number; // unix seconds
  dtend: number; // unix seconds
  rrule?: string; // 🔁 後端要求帶；新增預設空字串
};

export type ParsedMentorTimeslot = {
  id: number;
  type: 'ALLOW' | 'BLOCK';
  start: Date;
  end: Date;
  durationMinutes: number;
  formatted: string; // e.g. 2025-08-18 09:00 ~ 10:00
  dateKey: string; // YYYY-MM-DD (local)
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
  addSlotForSelectedDate: (opts: {
    type: 'ALLOW' | 'BLOCK';
    startTime: string; // HH:mm
    endTime: string; // HH:mm
  }) => void;
  deleteDraftSlot: (id: number) => void;
  confirmChanges: () => void;
  resetChanges: () => void;
};

// ---- helpers ----
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

/** 新增用負數 id（-1, -2, ...）避免誤傳給後端被當作更新 */
const nextTempId = (rows: RawMentorTimeslot[]) => {
  const negatives = rows.filter((r) => r.id < 0).map((r) => r.id);
  return negatives.length ? Math.min(...negatives) - 1 : -1;
};

/** 後端 → Raw（保留 rrule） */
const backendToRaw = (t: ScheduleTimeSlots): RawMentorTimeslot => {
  const toUnixSec = (v: unknown): number => {
    if (typeof v === 'number') return v > 1e12 ? Math.floor(v / 1000) : v;
    return Math.floor(new Date(v as any).getTime() / 1000);
  };
  return {
    id: Number(t.id) || Math.floor(Math.random() * 1e9), // 後端 id 應為正數
    type: t.dt_type,
    dtstart: toUnixSec(t.dtstart as any),
    dtend: toUnixSec(t.dtend as any),
    rrule: t.rrule ?? '', // 🔁 保留（更新時要帶回去）
  };
};

export const useMentorSchedule = (
  opts: Options = {}
): UseMentorScheduleReturn => {
  const {
    storageKey = 'mentor.timeslots',
    seed = [],
    mode = 'local',
    backend,
    debug = false,
  } = opts;

  const log = (...args: any[]) => {
    if (debug) console.log('[MentorSchedule]', ...args);
  };

  const [saved, setSaved] = useState<RawMentorTimeslot[]>([]);
  const [draft, setDraft] = useState<RawMentorTimeslot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    dayjs().format('YYYY-MM-DD')
  );

  /** 只有「後端已存在」的 id（正數）才視為 persisted */
  const persistedIdSet = useMemo(
    () => new Set(saved.filter((s) => s.id > 0).map((s) => s.id)),
    [saved]
  );

  /** Raw → Backend：新增不帶 id；更新才帶 id；一律帶 rrule */
  const toServiceSlot = useCallback(
    (r: RawMentorTimeslot): UpsertTimeslotBackend => {
      const slot: UpsertTimeslotBackend = {
        dt_type: r.type,
        dtstart: r.dtstart,
        dtend: r.dtend,
        rrule: r.rrule ?? '', // 🔁 後端需要
      };
      if (r.id > 0 && persistedIdSet.has(r.id)) {
        slot.id = r.id;
      }
      return slot;
    },
    [persistedIdSet]
  );

  // initial load
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
            log('loaded from backend:', { count: raws.length, raws });
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
          log('loaded from local:', { count: base.length, base });
        }
      }
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, storageKey, backend?.userId, backend?.year, backend?.month]);

  // derived
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

  const dirty = useMemo(
    () => JSON.stringify(saved) !== JSON.stringify(draft),
    [saved, draft]
  );

  useEffect(() => {
    log('dirty changed:', {
      dirty,
      savedLen: saved.length,
      draftLen: draft.length,
      saved,
      draft,
    });
  }, [dirty, saved, draft]); // eslint-disable-line

  // actions: add/delete on DRAFT only
  const addSlotForSelectedDate: UseMentorScheduleReturn['addSlotForSelectedDate'] =
    useCallback(
      ({ type, startTime, endTime }) => {
        log('addSlotForSelectedDate called:', {
          selectedDate,
          type,
          startTime,
          endTime,
        });
        if (!selectedDate) {
          log('add aborted: no selectedDate');
          return;
        }
        if (!startTime || !endTime) {
          log('add aborted: missing time');
          return;
        }

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

        log('parsed times:', {
          sISO: s.toISOString?.(),
          eISO: e.toISOString?.(),
          sValid: s.isValid(),
          eValid: e.isValid(),
          sUnix: s.valueOf(),
          eUnix: e.valueOf(),
        });

        if (!s.isValid() || !e.isValid()) {
          log('add aborted: invalid date parse');
          return;
        }
        if (e.isSameOrBefore(s)) {
          log('add aborted: end <= start');
          return;
        }

        setDraft((prev) => {
          const next: RawMentorTimeslot[] = [
            ...prev,
            {
              id: nextTempId(prev), // 負數暫存 id
              type,
              dtstart: Math.floor(s.valueOf() / 1000),
              dtend: Math.floor(e.valueOf() / 1000),
              rrule: '', // 🔁 新增預設空字串
            },
          ];
          log('draft added:', {
            before: prev.length,
            after: next.length,
            next,
          });
          return next;
        });
      },
      [selectedDate, log]
    );

  const deleteDraftSlot = useCallback(
    (id: number) => {
      setDraft((prev) => {
        const next = prev.filter((r) => r.id !== id);
        log('draft deleted:', { id, before: prev.length, after: next.length });
        return next;
      });
    },
    [log]
  );

  // persistence
  const confirmChanges = useCallback(() => {
    log('confirmChanges clicked:', { mode, backend, dirty });
    if (!dirty) {
      log('confirm aborted: not dirty');
      return;
    }

    if (mode === 'backend') {
      if (!backend?.userId) {
        log('confirm fallback to local: missing backend.userId');
        writeToStorage(storageKey, draft);
        setSaved(draft);
        return;
      }

      // 計算這個月的 until（月底 23:59:59）
      const endOfMonthUnix = dayjs(
        `${backend.year}-${String(backend.month).padStart(2, '0')}-01`
      )
        .endOf('month')
        .hour(23)
        .minute(59)
        .second(59)
        .millisecond(0)
        .unix();

      const payload = draft.map(toServiceSlot);
      log('will PUT', { until: endOfMonthUnix, timeslots: payload });

      saveMentorSchedule({
        userId: backend.userId,
        until: endOfMonthUnix,
        timeslots: payload,
      })
        .then((ok) => {
          log('PUT result:', ok);
          if (!ok) return;
          // 成功後 refetch
          fetchMentorSchedule({
            userId: backend.userId,
            year: backend.year,
            month: backend.month,
          })
            .then((data) => {
              const raws = (data?.timeslots ?? [])
                .map(backendToRaw)
                .filter((r) => {
                  const d = dayjs(r.dtstart * 1000);
                  return (
                    d.year() === backend.year && d.month() + 1 === backend.month
                  );
                });
              log('refetched after PUT:', { count: raws.length, raws });
              setSaved(raws);
              setDraft(raws);
            })
            .catch((e) => log('refetch error after PUT:', e));
        })
        .catch((e) => log('saveMentorSchedule error:', e));
    } else {
      log('saving to local storage…');
      writeToStorage(storageKey, draft);
      setSaved(draft);
    }
  }, [
    mode,
    backend?.userId,
    backend?.year,
    backend?.month,
    draft,
    storageKey,
    toServiceSlot,
    dirty,
    log,
  ]);

  const resetChanges = useCallback(() => {
    log('resetChanges clicked');
    if (
      mode === 'backend' &&
      backend?.userId &&
      backend?.year &&
      backend?.month
    ) {
      fetchMentorSchedule({
        userId: backend.userId,
        year: backend.year,
        month: backend.month,
      })
        .then((data) => {
          const raws = (data?.timeslots ?? []).map(backendToRaw).filter((r) => {
            const d = dayjs(r.dtstart * 1000);
            return d.year() === backend.year && d.month() + 1 === backend.month;
          });
          log('reset fetched:', { count: raws.length, raws });
          setDraft(raws);
          setSaved(raws);
        })
        .catch((e) => log('reset fetch error:', e));
    } else {
      setDraft(saved);
    }
  }, [mode, backend?.userId, backend?.year, backend?.month, saved, log]);

  return {
    loaded,
    dirty,
    selectedDate,
    setSelectedDate,
    parsedDraft,
    draftForSelectedDate,
    addSlotForSelectedDate,
    deleteDraftSlot,
    confirmChanges,
    resetChanges,
  };
};
