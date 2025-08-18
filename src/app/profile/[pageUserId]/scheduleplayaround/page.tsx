'use client';

import React, { useState } from 'react';

import { useMentorSchedule } from '@/hooks/useMentorSchedule';

export default function Page({
  params: { pageUserId },
}: {
  params: { pageUserId: string };
}) {
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
  } = useMentorSchedule({ storageKey: `mentor.timeslots:${pageUserId}` });

  const [type, setType] = useState<'ALLOW' | 'BLOCK'>('ALLOW');
  const [startTime, setStartTime] = useState(''); // HH:mm
  const [endTime, setEndTime] = useState(''); // HH:mm

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
      <h1 className="text-xl font-bold">
        Mentor Schedule（Calendar + Draft/Confirm）
      </h1>

      {/* 1) Calendar (date picker) */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">選擇日期</label>
        <input
          type="date"
          value={selectedDate ?? ''}
          onChange={(e) => setSelectedDate(e.target.value || null)}
          className="rounded border px-2 py-1"
        />
      </div>

      {/* 2) Add time slots for selected date */}
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
          * 先累積在草稿（hook 內），按下 Confirm 才會寫入 localStorage。
        </p>
      </div>

      {/* 3) List draft slots for the selected date */}
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

      {/* 4) Confirm / Reset */}
      <div className="flex items-center gap-2">
        <button
          onClick={confirmChanges}
          disabled={!dirty}
          className="bg-green-600 text-white rounded px-3 py-1 disabled:opacity-40"
        >
          Confirm（寫入 localStorage）
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
