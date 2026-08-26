import { AsyncReadManager, type AsyncReadResult } from '@/lib/asyncReadManager';
import { createKeyedCache } from '@/lib/createKeyedCache';
import type { ReservationState } from '@/services/reservations';
import type { Reservation } from '@/types/reservation';

export interface FetchReservationsResult {
  items: Reservation[];
  next_dtend: number;
}

/** One cache entry per user *and* reservation state. */
export interface ReservationReadKey {
  userId: string;
  state: ReservationState;
}

function toCacheKey({ userId, state }: ReservationReadKey): string {
  return `${userId}_${state}`;
}

// Private to this module: nothing outside ReservationReadModel may reach the
// shared reservation cache directly. All reads, writes, and invalidation go
// through the methods below, which own the key shape and the (TTL-less,
// invalidate-driven - see CONTEXT.md) cache policy so callers never pass a
// TTL or a cache handle in.
const cache = createKeyedCache<string, FetchReservationsResult>();
const manager = new AsyncReadManager<string, FetchReservationsResult>(cache);

export interface ReservationReadModel {
  /** Synchronous cached-snapshot read; does not trigger a fetch. */
  get(key: ReservationReadKey): FetchReservationsResult | undefined;
  /** Direct write, primarily for framework plumbing (initial-data hydration) - prefer `update()`. */
  set(key: ReservationReadKey, value: FetchReservationsResult): void;
  /**
   * The live read path: serves a cache hit synchronously, de-dupes
   * concurrent fetches for the same key, and notifies `onUpdate` with
   * `{ data, isLoading, error }` as the fetch resolves.
   */
  subscribe(
    key: ReservationReadKey,
    fetcher: (
      signal: AbortSignal,
      context?: { force?: boolean }
    ) => Promise<FetchReservationsResult>,
    onUpdate: (result: AsyncReadResult<FetchReservationsResult>) => void,
    options?: { force?: boolean; initialData?: FetchReservationsResult }
  ): () => void;
  /** Derive the next value from the current cached value (optimistic removal, pagination append, ...). */
  update(
    key: ReservationReadKey,
    updater: (
      current: FetchReservationsResult | undefined
    ) => FetchReservationsResult | undefined
  ): void;
  /** Drop the cached value at `key` and cancel any fetch in flight for it. */
  invalidate(key: ReservationReadKey): void;
  /** Test-only: reset every cached entry, listener, and in-flight fetch. */
  clear(): void;
}

export const reservationReadModel: ReservationReadModel = {
  get(key) {
    return manager.get(toCacheKey(key));
  },
  set(key, value) {
    manager.set(toCacheKey(key), value);
  },
  subscribe(key, fetcher, onUpdate, options) {
    return manager.subscribe(toCacheKey(key), fetcher, onUpdate, options);
  },
  update(key, updater) {
    manager.update(toCacheKey(key), updater);
  },
  invalidate(key) {
    manager.invalidate(toCacheKey(key));
  },
  clear() {
    manager.clear();
  },
};
