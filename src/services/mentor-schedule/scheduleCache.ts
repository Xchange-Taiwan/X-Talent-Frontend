import { RawMentorTimeslot } from '@/lib/profile/scheduleHelpers';

import type { ScheduleMonthRef } from './sync';

const cache = new Map<string, RawMentorTimeslot[]>();
const inflight = new Map<string, Promise<RawMentorTimeslot[]>>();

export function cacheKey(ref: ScheduleMonthRef): string {
  return `${ref.userId}:${ref.year}-${ref.month}`;
}

export function readCache(key: string): RawMentorTimeslot[] | undefined {
  return cache.get(key);
}

export function writeCache(key: string, raws: RawMentorTimeslot[]): void {
  cache.set(key, raws);
}

export function readInflight(
  key: string
): Promise<RawMentorTimeslot[]> | undefined {
  return inflight.get(key);
}

export function trackInflight(
  key: string,
  promise: Promise<RawMentorTimeslot[]>
): Promise<RawMentorTimeslot[]> {
  inflight.set(key, promise);
  promise.finally(() => {
    if (inflight.get(key) === promise) inflight.delete(key);
  });
  return promise;
}

export function clearAllScheduleCache(): void {
  cache.clear();
  inflight.clear();
}
