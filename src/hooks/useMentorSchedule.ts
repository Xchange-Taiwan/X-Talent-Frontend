import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';

export type RawMentorTimeslot = {
  id: number;
  type: 'ALLOW' | 'BLOCK';
  dtstart: number; // unix 秒
  dtend: number; // unix 秒
};

export type ParsedMentorTimeslot = {
  id: number;
  type: 'ALLOW' | 'BLOCK';
  start: Date;
  end: Date;
  durationMinutes: number;
  formatted: string;
};

type UseMentorScheduleReturn = {
  parsed: ParsedMentorTimeslot[];
  createFromDates: (opts: {
    type: 'ALLOW' | 'BLOCK';
    start: Date;
    end: Date;
  }) => void;
  deleteTimeslot: (id: number) => void;
};

// ---- helpers ----
const format = (r: RawMentorTimeslot): ParsedMentorTimeslot => {
  const start = new Date(r.dtstart * 1000);
  const end = new Date(r.dtend * 1000);
  const durationMinutes = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60)
  );
  return {
    id: r.id,
    type: r.type,
    start,
    end,
    durationMinutes,
    formatted: `${dayjs(start).format('YYYY-MM-DD HH:mm')} ~ ${dayjs(end).format('HH:mm')}`,
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

type Options = {
  storageKey?: string;
  seed?: RawMentorTimeslot[];
};

export const useMentorSchedule = (
  opts: Options = {}
): UseMentorScheduleReturn & { loaded: boolean } => {
  const { storageKey = 'mentor.timeslots', seed = [] } = opts;

  const [rows, setRows] = useState<RawMentorTimeslot[]>([]);
  const [loaded, setLoaded] = useState(false);

  // ✅ 只依賴 storageKey；不要依賴 seed（避免每次 render 觸發初始化）
  useEffect(() => {
    const fromStore = readFromStorage(storageKey);
    setRows(fromStore ?? seed ?? []);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // ✅ 讀取完成後才寫回 localStorage，避免初始化期間把資料蓋掉
  useEffect(() => {
    if (!loaded) return;
    writeToStorage(storageKey, rows);
  }, [storageKey, rows, loaded]);

  const parsed = useMemo(() => rows.map(format), [rows]);

  const createFromDates = ({
    type,
    start,
    end,
  }: {
    type: 'ALLOW' | 'BLOCK';
    start: Date;
    end: Date;
  }) => {
    if (!(start instanceof Date) || isNaN(start.getTime())) return;
    if (!(end instanceof Date) || isNaN(end.getTime())) return;
    if (end <= start) return;

    setRows((prev) => [
      ...prev,
      {
        id: nextId(prev),
        type,
        dtstart: Math.floor(start.getTime() / 1000),
        dtend: Math.floor(end.getTime() / 1000),
      },
    ]);
  };

  const deleteTimeslot = (id: number) =>
    setRows((prev) => prev.filter((r) => r.id !== id));

  return { parsed, createFromDates, deleteTimeslot, loaded };
};
