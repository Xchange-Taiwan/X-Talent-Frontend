'use client';

import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(isSameOrBefore);
import { useCallback, useEffect, useMemo, useState } from 'react';

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

type Options = {
  storageKey?: string;
  seed?: RawMentorTimeslot[];
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
  confirmChanges: () => void; // write draft -> localStorage
  resetChanges: () => void; // revert draft <- saved
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

export const useMentorSchedule = (
  opts: Options = {}
): UseMentorScheduleReturn => {
  const { storageKey = 'mentor.timeslots', seed = [] } = opts;

  // Saved = committed copy in localStorage
  const [saved, setSaved] = useState<RawMentorTimeslot[]>([]);
  // Draft = working copy you edit until Confirm
  const [draft, setDraft] = useState<RawMentorTimeslot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    dayjs().format('YYYY-MM-DD')
  );

  // initial load
  useEffect(() => {
    const fromStore = readFromStorage(storageKey);
    const base = fromStore ?? seed ?? [];
    setSaved(base);
    setDraft(base);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

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
    writeToStorage(storageKey, draft);
    setSaved(draft);
  }, [draft, storageKey]);

  const resetChanges = useCallback(() => {
    setDraft(saved);
  }, [saved]);

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
