'use client';

import { useSyncExternalStore } from 'react';

import {
  computeReservationTimeInfo,
  evaluateReservationTimePhase,
  type ReservationTimeInfo,
  type ReservationTimeStatus,
} from '@/lib/reservation/reservationLifecyclePolicy';

export {
  computeReservationTimeInfo,
  evaluateReservationTimePhase,
  type ReservationTimeInfo,
  type ReservationTimeStatus,
};

const ONE_MINUTE_MS = 60_000;

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

export function useReservationTimeStatus(
  dtstartUnixSeconds: number,
  dtendUnixSeconds: number
): ReservationTimeInfo {
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return evaluateReservationTimePhase(dtstartUnixSeconds, dtendUnixSeconds);
}
