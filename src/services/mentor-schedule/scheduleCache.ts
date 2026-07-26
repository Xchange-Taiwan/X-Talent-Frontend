import { createKeyedCache } from '@/lib/createKeyedCache';
import { RawMentorTimeslot } from '@/lib/profile/scheduleHelpers';

import type { ScheduleMonthRef } from './sync';

const scheduleCacheInstance = createKeyedCache<string, RawMentorTimeslot[]>();

export function cacheKey(ref: ScheduleMonthRef): string {
  return `${ref.userId}:${ref.year}-${ref.month}`;
}

export function readCache(key: string): RawMentorTimeslot[] | undefined {
  return scheduleCacheInstance.get(key);
}

export function writeCache(key: string, raws: RawMentorTimeslot[]): void {
  scheduleCacheInstance.set(key, raws);
}

export function readInflight(
  key: string
): Promise<RawMentorTimeslot[]> | undefined {
  return scheduleCacheInstance.getInflight(key);
}

export function trackInflight(
  key: string,
  promise: Promise<RawMentorTimeslot[]>
): Promise<RawMentorTimeslot[]> {
  return scheduleCacheInstance.setInflight(key, promise);
}

export function clearAllScheduleCache(): void {
  scheduleCacheInstance.clear();
}
