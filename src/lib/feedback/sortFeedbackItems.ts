import { toFeedbackTimestampMs } from '@/lib/mentor/mentorStats';
import type { MentorFeedbackItem } from '@/types/feedback';

/**
 * Sorts mentor feedback items newest-first by `createdAt` using a single-pass
 * timestamp extraction. When every item has a valid timestamp and is already in
 * descending order (or any item lacks a parseable date), avoids running
 * `Array.prototype.sort`.
 */
export function sortFeedbackItems(
  items: ReadonlyArray<MentorFeedbackItem>
): MentorFeedbackItem[] {
  const length = items.length;
  if (length <= 1) {
    return [...items];
  }

  const timestamps = new Array<number>(length);
  let allValidDates = true;
  let alreadyDescending = true;

  for (let i = 0; i < length; i += 1) {
    const ts = toFeedbackTimestampMs(items[i].createdAt);
    timestamps[i] = ts;
    if (ts <= 0) {
      allValidDates = false;
      break;
    }
    if (i > 0 && timestamps[i - 1] < ts) {
      alreadyDescending = false;
    }
  }

  if (!allValidDates || alreadyDescending) {
    return [...items];
  }

  const indices = Array.from({ length }, (_, idx) => idx);
  indices.sort((a, b) => timestamps[b] - timestamps[a] || a - b);
  return indices.map((idx) => items[idx]);
}
