import { createKeyedCache } from '@/lib/createKeyedCache';
import { RawMentorTimeslot } from '@/lib/profile/scheduleHelpers';

import type { ScheduleMonthRef } from './sync';

export const scheduleCache = createKeyedCache<string, RawMentorTimeslot[]>();

export function cacheKey(ref: ScheduleMonthRef): string {
  return `${ref.userId}:${ref.year}-${ref.month}`;
}
