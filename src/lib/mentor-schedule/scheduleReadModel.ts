import { AsyncReadManager, type AsyncReadResult } from '@/lib/asyncReadManager';
import type { RawMentorTimeslot } from '@/lib/profile/scheduleHelpers';

/** One cache entry per mentor *and* calendar month. */
export interface ScheduleReadKey {
  userId: string;
  year: number;
  /** 1-12. */
  month: number;
}

export type ScheduleFetcher = (
  signal: AbortSignal
) => Promise<RawMentorTimeslot[]>;

export interface ScheduleReadOptions {
  force?: boolean;
  initialData?: RawMentorTimeslot[];
}

const manager = new AsyncReadManager<string, RawMentorTimeslot[]>();

const toCacheKey = (key: ScheduleReadKey): string =>
  `${key.userId}_${key.year}_${String(key.month).padStart(2, '0')}`;

/**
 * Narrow, mentor-schedule-scoped facade over a private `AsyncReadManager`
 * instance. Callers only ever pass `{ userId, year, month }` - the manager
 * and its string cache keys are hidden inside this module.
 *
 * Staleness contract: no TTL. Cached months never expire on their own; they
 * stay valid until an explicit write (`set` / `refresh` / `invalidate` /
 * `invalidateOrRefresh`, i.e. after a save, a reservation status mutation, or
 * a manual reload). Unlike reservation reads, a mentor's schedule segments
 * change through schedule saves or reservation bookings/status transitions,
 * all of which synchronize back into this model.
 */
export interface MentorScheduleReadModel {
  /**
   * Synchronous read of an already-cached month, or `undefined` when that
   * month has not been loaded yet. Never triggers a fetch. Used where a
   * caller needs a month's rows without subscribing (e.g. a cross-month
   * draft edit checking whether the target month is already in memory).
   */
  get(key: ScheduleReadKey): RawMentorTimeslot[] | undefined;
  /**
   * Direct write for callers that have just fetched a month themselves (e.g.
   * post-save reload). Cancels any in-flight fetch for `key` and notifies
   * active subscribers with the new rows.
   */
  set(key: ScheduleReadKey, value: RawMentorTimeslot[]): void;
  subscribe(
    key: ScheduleReadKey,
    fetcher: ScheduleFetcher,
    onUpdate: (result: AsyncReadResult<RawMentorTimeslot[]>) => void,
    options?: ScheduleReadOptions
  ): () => void;
  /**
   * Force a fresh network read for `key` and publish it to every active
   * subscriber. Resolves with the published result, or `null` when the
   * refresh was superseded before publishing (its key was cleared or
   * overwritten mid-flight - an account switch, say), which is exactly the
   * case where the caller should stay quiet rather than report a failure.
   */
  refresh(
    key: ScheduleReadKey,
    fetcher: ScheduleFetcher
  ): Promise<AsyncReadResult<RawMentorTimeslot[]> | null>;
  /**
   * Drops the cached month immediately and cancels any in-flight fetch for
   * `key` without starting a new request.
   */
  invalidate(key: ScheduleReadKey): void;
  /**
   * Drops `key` immediately when nothing is subscribed to that month (0
   * network calls), or refreshes `key` in place via `AsyncReadManager.refresh`
   * when a calendar view is actively mounted on it.
   */
  invalidateOrRefresh(
    key: ScheduleReadKey,
    fetcher: ScheduleFetcher
  ): Promise<AsyncReadResult<RawMentorTimeslot[]> | null>;
  /**
   * Fire-and-forget warm-up for a month nothing is looking at yet. A cache
   * hit or an already in-flight fetch for the same key is a no-op, and
   * failures are swallowed - a prefetch must never disrupt the user.
   */
  prefetch(key: ScheduleReadKey, fetcher: ScheduleFetcher): void;
  /**
   * Reset every cached month, listener, and in-flight fetch. Used in tests,
   * and in production on an account switch: months belong to one mentor, and
   * cancelling the outgoing user's in-flight reads here is what stops their
   * rows from ever reaching the incoming user's calendar.
   */
  clear(): void;
}

export const scheduleReadModel: MentorScheduleReadModel = {
  get(key) {
    return manager.get(toCacheKey(key));
  },
  set(key, value) {
    manager.set(toCacheKey(key), value);
  },
  subscribe(key, fetcher, onUpdate, options) {
    return manager.subscribe(toCacheKey(key), fetcher, onUpdate, options);
  },
  refresh(key, fetcher) {
    return manager.refresh(toCacheKey(key), fetcher);
  },
  invalidate(key) {
    manager.invalidate(toCacheKey(key));
  },
  invalidateOrRefresh(key, fetcher) {
    const ck = toCacheKey(key);
    if (manager.getListenerCount(ck) > 0) {
      return manager.refresh(ck, fetcher);
    }
    manager.invalidate(ck);
    return Promise.resolve(null);
  },
  prefetch(key, fetcher) {
    void manager.prefetch(toCacheKey(key), fetcher);
  },
  clear() {
    manager.clear();
  },
};
