import { AsyncReadManager, type AsyncReadResult } from '@/lib/asyncReadManager';
import type { RawMentorTimeslot } from '@/lib/profile/scheduleHelpers';

/** One cache entry per mentor *and* calendar month. */
export interface ScheduleReadKey {
  userId: string;
  year: number;
  month: number; // 1-12
}

/**
 * How a month's rows are actually fetched. The read model owns caching,
 * de-duplication and cancellation; it deliberately does not own the network
 * call itself, so `src/services/mentor-schedule` stays the only place that
 * knows the schedule endpoint (mirroring `ReservationReadModel`).
 */
type ScheduleFetcher = (signal: AbortSignal) => Promise<RawMentorTimeslot[]>;

function toCacheKey({ userId, year, month }: ScheduleReadKey): string {
  return `${userId}:${year}-${month}`;
}

// Private to this module: nothing outside MentorScheduleReadModel may reach
// the schedule manager directly, so the key shape and the cache policy live in
// exactly one place. Months carry no TTL - a mentor's own schedule only
// changes through this app's own writes (save, discard, explicit reload), all
// of which come back through `set()` / `refresh()` below. See CONTEXT.md
// ("Staleness Contract").
const manager = new AsyncReadManager<string, RawMentorTimeslot[]>();

export interface MentorScheduleReadModel {
  /** Synchronous cached-snapshot read; does not trigger a fetch. */
  get(key: ScheduleReadKey): RawMentorTimeslot[] | undefined;
  /**
   * Direct write - the read-your-writes path for a save/discard that already
   * fetched the month itself. Cancels any fetch in flight for `key` so a
   * slower response cannot clobber it, and publishes the new rows to every
   * live subscriber.
   */
  set(key: ScheduleReadKey, value: RawMentorTimeslot[]): void;
  /**
   * The live read path: serves a cache hit synchronously, de-dupes
   * concurrent fetches for the same key, cancels the fetch when the last
   * subscriber goes away (unmount, or a month/account switch), and notifies
   * `onUpdate` with `{ data, isLoading, error }` as the fetch resolves.
   */
  subscribe(
    key: ScheduleReadKey,
    fetcher: ScheduleFetcher,
    onUpdate: (result: AsyncReadResult<RawMentorTimeslot[]>) => void,
    options?: { force?: boolean; initialData?: RawMentorTimeslot[] }
  ): () => void;
  /**
   * Refetch `key` from the network even on a cache hit, publish the result
   * to every live subscriber, and resolve once it has landed - so a caller
   * that must not act until the calendar reflects the new rows (e.g. closing
   * a quick-reply dialog after an accept) can await it.
   *
   * Resolves with the published `{ data, isLoading, error }`, or `null` when
   * the refresh was superseded before publishing (its key was cleared or
   * overwritten mid-flight - an account switch, say), which is exactly the
   * case where the caller should stay quiet rather than report a failure.
   */
  refresh(
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
  prefetch(key, fetcher) {
    void manager.prefetch(toCacheKey(key), fetcher);
  },
  clear() {
    manager.clear();
  },
};
