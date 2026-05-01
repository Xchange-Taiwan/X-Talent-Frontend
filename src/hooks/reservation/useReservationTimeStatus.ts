'use client';

import { useSyncExternalStore } from 'react';

export type ReservationTimeStatus =
  | 'far'
  | 'soon'
  | 'imminent'
  | 'live'
  | 'ended';

export interface ReservationTimeInfo {
  status: ReservationTimeStatus;
  label: string;
}

const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function startInterval(): void {
  if (intervalId !== null) return;
  intervalId = setInterval(() => {
    listeners.forEach((listener) => listener());
  }, ONE_MINUTE_MS);
}

function stopInterval(): void {
  if (intervalId === null) return;
  clearInterval(intervalId);
  intervalId = null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) startInterval();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopInterval();
  };
}

function getSnapshot(): number {
  return Math.floor(Date.now() / ONE_MINUTE_MS);
}

function getServerSnapshot(): number {
  return 0;
}

export function computeReservationTimeInfo(
  dtstartUnixSeconds: number,
  dtendUnixSeconds: number,
  nowMs: number = Date.now()
): ReservationTimeInfo {
  const startMs = dtstartUnixSeconds * 1000;
  const endMs = dtendUnixSeconds * 1000;

  if (nowMs >= endMs) return { status: 'ended', label: '已結束' };
  if (nowMs >= startMs) return { status: 'live', label: '進行中' };

  const diffMs = startMs - nowMs;

  if (diffMs >= ONE_DAY_MS) {
    const days = Math.floor(diffMs / ONE_DAY_MS);
    return { status: 'far', label: `${days} 天後` };
  }

  if (diffMs >= ONE_HOUR_MS) {
    const hours = Math.floor(diffMs / ONE_HOUR_MS);
    return { status: 'soon', label: `${hours} 小時後開始` };
  }

  if (diffMs >= ONE_MINUTE_MS) {
    const minutes = Math.floor(diffMs / ONE_MINUTE_MS);
    return { status: 'imminent', label: `${minutes} 分鐘後開始` };
  }

  return { status: 'imminent', label: '即將開始' };
}

export function useReservationTimeStatus(
  dtstartUnixSeconds: number,
  dtendUnixSeconds: number
): ReservationTimeInfo {
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return computeReservationTimeInfo(dtstartUnixSeconds, dtendUnixSeconds);
}
