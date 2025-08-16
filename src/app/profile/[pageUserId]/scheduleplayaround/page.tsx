'use client';

import React, { useState } from 'react';

import { useMentorSchedule } from '@/hooks/useMentorSchedule';

/**
 * 超簡版測試頁（get + 新增 + 刪除）
 * 儲存邏輯已內建在 hook 中（例如 autosave）
 */
export default function Page({
  params: { pageUserId },
}: {
  params: { pageUserId: string };
}) {
  // ⬇️ hook 內部自動儲存（本頁不再需要 save/reload）
  const { parsed, createFromDates, deleteTimeslot } = useMentorSchedule({
    storageKey: `mentor.timeslots:${pageUserId}`,
  });

  const [type, setType] = useState<'ALLOW' | 'BLOCK'>('ALLOW');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const onAdd = () => {
    if (!start || !end) return alert('請選擇開始與結束時間');
    const s = new Date(start);
    const e = new Date(end);
    if (e <= s) return alert('結束時間必須晚於開始時間');
    createFromDates({ type, start: s, end: e });
    setStart('');
    setEnd('');
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-bold">Mentor Schedule（讀 / 寫 / 刪）</h1>

      {/* 新增 */}
      <div className="space-y-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'ALLOW' | 'BLOCK')}
          className="rounded border px-2 py-1"
        >
          <option value="ALLOW">ALLOW</option>
          <option value="BLOCK">BLOCK</option>
        </select>
        <input
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="rounded border px-2 py-1"
        />
        <input
          type="datetime-local"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="rounded border px-2 py-1"
        />
        <div className="flex gap-2">
          <button
            onClick={onAdd}
            className="bg-black text-white rounded px-3 py-1"
          >
            新增
          </button>
        </div>
      </div>

      {/* 列表 */}
      <ul className="list-disc space-y-1 pl-5">
        {parsed.length === 0 && <li>目前沒有資料</li>}
        {parsed.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <span>
              {p.formatted}（{p.type}）
            </span>
            <button
              onClick={() => deleteTimeslot(p.id)}
              className="border-red-400 text-red-600 rounded border px-2 py-0.5 text-xs"
            >
              刪除
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
