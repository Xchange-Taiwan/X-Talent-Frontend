// useMentorSchedule.ts
'use client';

import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(isSameOrBefore);

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  fetchMentorSchedule,
  saveMentorSchedule,
  ScheduleTimeSlots,
} from '@/services/mentorSchedule/schedule'; // ← 依你的實際路徑

export type RawMentorTimeslot = {
  id: number;
  type: 'ALLOW' | 'BLOCK';
  dtstart: number; // unix seconds
  dtend: number; // unix seconds
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

/** ========= 新增：資料來源選項 ========= */
type Options = {
  storageKey?: string;
  seed?: RawMentorTimeslot[];

  /** 切換資料來源：'local' 或 'backend'（預設 local） */
  mode?: 'local' | 'backend';

  /** backend 模式所需參數（以「月」為單位抓資料） */
  backend?: {
    userId: string;
    year: number;
    month: number; // 1-12
  };
};

export type UseMentorScheduleReturn = {
  // state
  loaded: boolean;
  dirty: boolean; // draft differs from saved
  selectedDate: string | null; // YYYY-MM-DD (local)
  setSelectedDate: (dateStr: string | null) => void;

  // derived lists
  parsedDraft: ParsedMentorTimeslot[]; // all draft slots (for debug or global list)
  draftForSelectedDate: ParsedMentorTimeslot[]; // filtered by selectedDate

  // actions (all modify DRAFT only)
  addSlotForSelectedDate: (opts: {
    type: 'ALLOW' | 'BLOCK';
    startTime: string; // HH:mm
    endTime: string; // HH:mm
  }) => void;
  deleteDraftSlot: (id: number) => void;

  // persistence
  confirmChanges: () => void; // write draft -> localStorage or Backend
  resetChanges: () => void; // revert draft <- saved or refetch
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

const nextId = (rows: RawMentorTimeslot[]) =>
  (rows.length ? Math.max(...rows.map((r) => r.id)) : 0) + 1;

/** 後端（ScheduleTimeSlots）→ RawMentorTimeslot */
const backendToRaw = (t: ScheduleTimeSlots): RawMentorTimeslot => {
  // t.dtstart / t.dtend 可能是 Date/字串/數字，統一轉成時間戳（秒）
  const toUnixSec = (v: unknown): number => {
    if (typeof v === 'number') {
      // 可能已是秒或毫秒，這裡假設毫秒太大：>1e12 視為毫秒
      return v > 1e12 ? Math.floor(v / 1000) : v;
    }
    const ms = new Date(v as any).getTime();
    return Math.floor(ms / 1000);
  };

  return {
    id: Number(t.id) || Math.floor(Math.random() * 1e9),
    type: t.dt_type,
    dtstart: toUnixSec(t.dtstart as any),
    dtend: toUnixSec(t.dtend as any),
  };
};

/** RawMentorTimeslot → 後端 upsert slot */
const rawToBackendSlot = (r: RawMentorTimeslot) => ({
  id: r.id,
  dt_type: r.type,
  dtstart: r.dtstart,
  dtend: r.dtend,
});

export const useMentorSchedule = (
  opts: Options = {}
): UseMentorScheduleReturn => {
  const {
    storageKey = 'mentor.timeslots',
    seed = [],
    mode = 'local',
    backend,
  } = opts;

  // Saved = committed copy（localStorage 或 Backend 已存在值）
  const [saved, setSaved] = useState<RawMentorTimeslot[]>([]);
  // Draft = working copy you edit until Confirm
  const [draft, setDraft] = useState<RawMentorTimeslot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    dayjs().format('YYYY-MM-DD')
  );

  // initial load
  useEffect(() => {
    let ignore = false;
    (async () => {
      if (
        mode === 'backend' &&
        backend?.userId &&
        backend?.year &&
        backend?.month
      ) {
        const data = await fetchMentorSchedule({
          userId: backend.userId,
          year: backend.year,
          month: backend.month,
        });

        const raws = (data?.timeslots ?? [])
          .map(backendToRaw)
          // 保險：只保留指定年月（若後端已濾好可移除）
          .filter((r) => {
            const d = dayjs(r.dtstart * 1000);
            return d.year() === backend.year && d.month() + 1 === backend.month;
          });

        if (!ignore) {
          setSaved(raws);
          setDraft(raws);
          setLoaded(true);
        }
      } else {
        const fromStore = readFromStorage(storageKey);
        const base = fromStore ?? seed ?? [];
        if (!ignore) {
          setSaved(base);
          setDraft(base);
          setLoaded(true);
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

  // actions: add/delete on DRAFT only
  const addSlotForSelectedDate: UseMentorScheduleReturn['addSlotForSelectedDate'] =
    useCallback(
      ({ type, startTime, endTime }) => {
        if (!selectedDate) return;
        if (!startTime || !endTime) return;
        const s = dayjs(`${selectedDate} ${startTime}`);
        const e = dayjs(`${selectedDate} ${endTime}`);
        if (!s.isValid() || !e.isValid()) return;
        if (e.isSameOrBefore(s)) return;

        setDraft((prev) => [
          ...prev,
          {
            id: nextId(prev),
            type,
            dtstart: Math.floor(s.valueOf() / 1000),
            dtend: Math.floor(e.valueOf() / 1000),
          },
        ]);
      },
      [selectedDate]
    );

  const deleteDraftSlot = useCallback((id: number) => {
    setDraft((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // persistence
  const confirmChanges = useCallback(() => {
    if (mode === 'backend') {
      if (!backend?.userId) {
        console.warn(
          'confirmChanges: backend.userId 未提供，改以 local 儲存。'
        );
        writeToStorage(storageKey, draft);
        setSaved(draft);
        return;
      }
      const okPromise = saveMentorSchedule({
        userId: backend.userId,
        timeslots: draft.map(rawToBackendSlot),
      });
      okPromise.then((ok) => {
        if (ok) setSaved(draft);
        else console.error('後端儲存失敗；保持原狀。');
      });
    } else {
      writeToStorage(storageKey, draft);
      setSaved(draft);
    }
  }, [mode, backend?.userId, draft, storageKey]);

  const resetChanges = useCallback(() => {
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
      }).then((data) => {
        const raws = (data?.timeslots ?? []).map(backendToRaw);
        setDraft(raws);
        setSaved(raws);
      });
    } else {
      setDraft(saved);
    }
  }, [mode, backend?.userId, backend?.year, backend?.month, saved]);

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
