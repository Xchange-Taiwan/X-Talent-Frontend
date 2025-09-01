// src/app/profile/[pageUserId]/scheduleplayaround/page.tsx
'use client';

import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';

import { useMentorSchedule } from '@/hooks/useMentorSchedule';

type SourceMode = 'local' | 'backend';

const pad2 = (n: string | number) => String(n ?? '').padStart(2, '0');
const toInt = (v: string) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
};
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

export default function Page({
  params: { pageUserId },
}: {
  params: { pageUserId: string };
}) {
  const [source, setSource] = useState<SourceMode>('backend');

  // 月份/日期
  const [datePicker, setDatePicker] = useState<string>(
    dayjs().format('YYYY-MM-DD')
  );
  const viewYM = useMemo(
    () => dayjs(datePicker).startOf('month'),
    [datePicker]
  );
  const selectedYear = viewYM.year();
  const selectedMonth = viewYM.month() + 1;

  // Hook 參數
  const hookOpts: Parameters<typeof useMentorSchedule>[0] =
    source === 'backend'
      ? ({
          mode: 'backend',
          backend: {
            userId: String(pageUserId),
            year: selectedYear,
            month: selectedMonth,
          },
          debug: true,
        } as const)
      : ({
          mode: 'local',
          storageKey: `mentor.timeslots:${pageUserId}`,
          debug: true,
        } as const);

  const {
    loaded,
    dirty,
    selectedDate,
    setSelectedDate,
    parsedDraft, // 全部草稿（整月）
    draftForSelectedDate, // ✅ 只包含「被點日期」的 slots
    addSlotForSelectedDate,
    updateDraftSlot,
    deleteDraftSlot,
    confirmChanges,
    resetChanges,
  } = useMentorSchedule(hookOpts);

  // 維持 selectedDate 與 datePicker 一致
  useEffect(() => {
    setSelectedDate(datePicker || null);
  }, [datePicker, setSelectedDate]);

  /** =========== 月曆資料（簡版） =========== */
  const startOfMonth = viewYM.startOf('month');
  const endOfMonth = viewYM.endOf('month');
  const startOfGrid = startOfMonth.startOf('week');
  const endOfGrid = endOfMonth.endOf('week');
  const days: string[] = [];
  for (let d = startOfGrid; d.isBefore(endOfGrid); d = d.add(1, 'day')) {
    days.push(d.format('YYYY-MM-DD'));
  }
  const goPrevMonth = () =>
    setDatePicker(viewYM.subtract(1, 'month').format('YYYY-MM-DD'));
  const goNextMonth = () =>
    setDatePicker(viewYM.add(1, 'month').format('YYYY-MM-DD'));

  /** =========== 事件 =========== */
  // 在「被點到的日期」新增一筆預設 10:00~21:00
  const addDefaultForSelectedDate = () => {
    if (!selectedDate) return;
    addSlotForSelectedDate({
      type: 'ALLOW',
      startTime: '10:00',
      endTime: '21:00',
    });
  };

  // 勾選框：一天全開/全關
  const toggleSelectedDateEnabled = (checked: boolean) => {
    if (!selectedDate) return;
    if (checked) {
      addDefaultForSelectedDate();
    } else {
      draftForSelectedDate.forEach((p) => deleteDraftSlot(p.id));
    }
  };

  // 行內四格輸入 → 更新草稿
  const commitHHMM = (
    id: number,
    sH: string,
    sM: string,
    eH: string,
    eM: string
  ) => {
    const _sH = pad2(clamp(toInt(sH), 0, 23));
    const _sM = pad2(clamp(toInt(sM), 0, 59));
    const _eH = pad2(clamp(toInt(eH), 0, 23));
    const _eM = pad2(clamp(toInt(eM), 0, 59));
    updateDraftSlot(id, {
      startTime: `${_sH}:${_sM}`,
      endTime: `${_eH}:${_eM}`,
    });
  };

  if (!loaded) return <div className="p-6">Loading…</div>;

  const labelForSelected =
    selectedDate &&
    dayjs(selectedDate).year() === selectedYear &&
    dayjs(selectedDate).month() + 1 === selectedMonth
      ? dayjs(selectedDate).format('MMM D')
      : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-bold">Scheduling Setting</h1>

      {/* 資料來源切換 */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">資料來源：</span>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="radio"
            name="source"
            value="local"
            checked={source === 'local'}
            onChange={() => setSource('local')}
          />
          LocalStorage
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="radio"
            name="source"
            value="backend"
            checked={source === 'backend'}
            onChange={() => setSource('backend')}
          />
          Backend API（GET / PUT）
        </label>
      </div>

      {/* 月曆 */}
      <div className="rounded-lg border p-3">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={goPrevMonth} className="rounded border px-2 py-1">
            {'<'}
          </button>
          <div className="text-sm font-medium">
            {viewYM.format('MMMM YYYY')}
          </div>
          <button onClick={goNextMonth} className="rounded border px-2 py-1">
            {'>'}
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w) => (
            <div key={w} className="py-1 text-gray-600">
              {w}
            </div>
          ))}
          {days.map((d) => {
            const inMonth = dayjs(d).month() === viewYM.month();
            const hasSlots =
              parsedDraft.find((p) => p.dateKey === d) !== undefined;
            const isSelected = selectedDate === d;
            return (
              <button
                key={d}
                onClick={() => {
                  setDatePicker(d);
                  setSelectedDate(d);
                }}
                className={[
                  'h-9 rounded-md border text-sm',
                  inMonth ? '' : 'opacity-40',
                  hasSlots ? 'border-teal-400' : 'border-gray-200',
                  isSelected ? 'bg-teal-500 text-white' : '',
                ].join(' ')}
                title={d}
              >
                {dayjs(d).date()}
              </button>
            );
          })}
        </div>
      </div>

      {/* ✅ 只顯示「被點選」那一天的 slots */}
      <div className="space-y-3 rounded-lg border p-3">
        <div className="text-sm font-medium">Available time slots</div>

        {!labelForSelected && (
          <div className="text-gray-500">請選擇本月份中的某一天</div>
        )}

        {labelForSelected && (
          <div className="rounded border p-2">
            <div className="mb-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={draftForSelectedDate.length > 0}
                onChange={(e) => toggleSelectedDateEnabled(e.target.checked)}
              />
              <div className="text-sm font-medium">{labelForSelected}</div>
            </div>

            {draftForSelectedDate.map((p) => {
              const [sH, sM] = [
                dayjs(p.start).format('HH'),
                dayjs(p.start).format('mm'),
              ];
              const [eH, eM] = [
                dayjs(p.end).format('HH'),
                dayjs(p.end).format('mm'),
              ];

              return (
                <div key={p.id} className="mb-2 flex items-center gap-2">
                  {/* start HH */}
                  <input
                    defaultValue={sH}
                    onBlur={(e) => commitHHMM(p.id, e.target.value, sM, eH, eM)}
                    className="w-12 rounded border px-2 py-1 text-center"
                  />
                  <span>:</span>
                  {/* start mm */}
                  <input
                    defaultValue={sM}
                    onBlur={(e) => commitHHMM(p.id, sH, e.target.value, eH, eM)}
                    className="w-12 rounded border px-2 py-1 text-center"
                  />

                  <span>~</span>

                  {/* end HH */}
                  <input
                    defaultValue={eH}
                    onBlur={(e) => commitHHMM(p.id, sH, sM, e.target.value, eM)}
                    className="w-12 rounded border px-2 py-1 text-center"
                  />
                  <span>:</span>
                  {/* end mm */}
                  <input
                    defaultValue={eM}
                    onBlur={(e) => commitHHMM(p.id, sH, sM, eH, e.target.value)}
                    className="w-12 rounded border px-2 py-1 text-center"
                  />

                  {/* 刪除此 slot（僅改草稿；Confirm 才會真的刪） */}
                  <button
                    onClick={() => deleteDraftSlot(p.id)}
                    className="mx-1 text-xl leading-none"
                    title="刪除此時段（按 Confirm 才會真的刪）"
                  >
                    ×
                  </button>

                  {/* 在這一天再新增一筆預設時段 */}
                  <button
                    onClick={addDefaultForSelectedDate}
                    className="mx-1 text-xl leading-none"
                    title="新增一筆（10:00 ~ 21:00）"
                  >
                    ＋
                  </button>
                </div>
              );
            })}

            {draftForSelectedDate.length === 0 && (
              <button
                onClick={addDefaultForSelectedDate}
                className="rounded border px-2 py-1 text-xs"
              >
                新增 10:00 ~ 21:00
              </button>
            )}
          </div>
        )}
      </div>

      {/* Confirm / Reset */}
      <div className="flex items-center gap-2">
        <button
          onClick={confirmChanges}
          disabled={!dirty}
          className="bg-green-600 text-white rounded px-3 py-1 disabled:opacity-40"
        >
          Confirm（{source === 'local' ? '寫入 LocalStorage' : 'PUT 到 Backend'}
          ）
        </button>
        <button
          onClick={resetChanges}
          disabled={!dirty}
          className="rounded border px-3 py-1 disabled:opacity-40"
        >
          Reset（還原草稿）
        </button>
        {dirty && <span className="text-amber-600 text-xs">尚未儲存變更</span>}
      </div>
    </div>
  );
}
