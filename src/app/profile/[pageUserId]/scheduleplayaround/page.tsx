// src/app/profile/[pageUserId]/scheduleplayaround/page.tsx
'use client';

import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';

import { useMentorSchedule } from '@/hooks/useMentorSchedule';

type SourceMode = 'local' | 'backend';

export default function Page({
  params: { pageUserId },
}: {
  params: { pageUserId: string };
}) {
  const [type, setType] = useState<'ALLOW' | 'BLOCK'>('ALLOW');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [source, setSource] = useState<SourceMode>('local');

  const [datePicker, setDatePicker] = useState<string>(
    dayjs().format('YYYY-MM-DD')
  );
  const selectedYear = useMemo(() => dayjs(datePicker).year(), [datePicker]);
  const selectedMonth = useMemo(
    () => dayjs(datePicker).month() + 1,
    [datePicker]
  );

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
    draftForSelectedDate,
    addSlotForSelectedDate,
    deleteDraftSlot,
    confirmChanges,
    resetChanges,
  } = useMentorSchedule(hookOpts);

  useEffect(() => {
    setSelectedDate(datePicker || null);
  }, [datePicker, setSelectedDate]);

  if (!loaded) return <div className="p-6">Loading…</div>;

  const onAdd = () => {
    if (!selectedDate) return alert('請先選擇日期');
    if (!startTime || !endTime) return alert('請選擇開始與結束時間');
    addSlotForSelectedDate({ type, startTime, endTime });
    setStartTime('');
    setEndTime('');
  };

  return (
    <div className="max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-bold">Mentor Schedule（Local / Backend）</h1>

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

      {/* 選擇日期 */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">選擇日期</label>
        <input
          type="date"
          value={datePicker}
          onChange={(e) => setDatePicker(e.target.value)}
          className="rounded border px-2 py-1"
        />
        {source === 'backend' && (
          <p className="text-xs text-gray-500">
            目前向後端取：{selectedYear} 年 / {selectedMonth} 月的時段
          </p>
        )}
      </div>

      {/* 新增時段 */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'ALLOW' | 'BLOCK')}
            className="rounded border px-2 py-1"
          >
            <option value="ALLOW">ALLOW</option>
            <option value="BLOCK">BLOCK</option>
          </select>

          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="rounded border px-2 py-1"
          />
          <span>~</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="rounded border px-2 py-1"
          />

          <button
            onClick={onAdd}
            className="bg-black text-white rounded px-3 py-1"
          >
            新增時間段
          </button>
        </div>
        <p className="text-xs text-gray-500">
          * 先累積在草稿，按下 Confirm 才會「儲存」。
        </p>
      </div>

      {/* 草稿列表 */}
      <div className="space-y-2">
        <h2 className="font-medium">{selectedDate ?? '未選擇日期'} 的時間段</h2>
        <ul className="space-y-1">
          {draftForSelectedDate.length === 0 && (
            <li className="text-gray-500">目前沒有資料</li>
          )}
          {draftForSelectedDate.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded border px-3 py-1"
            >
              <span>
                {p.formatted}（{p.type}）
              </span>
              <button
                onClick={() => deleteDraftSlot(p.id)}
                className="border-red-400 text-red-600 rounded border px-2 py-0.5 text-xs"
              >
                刪除
              </button>
            </li>
          ))}
        </ul>
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
