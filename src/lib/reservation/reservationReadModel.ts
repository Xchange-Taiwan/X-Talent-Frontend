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
  /**
   * Optional month-boundary scope for callers that need a bounded TTL
   * window per calendar month instead of the default permanent,
   * invalidate-driven slot - currently only the mentor-schedule calendar
   * (see `MENTOR_SCHEDULE_RESERVATIONS_TTL_MS`). Omit for the single
   * unscoped slot per (userId, state) that every other caller (e.g. the
   * reservation dashboard) reads and writes.
   */
  endOfMonthUnix?: number;
}

function toCacheKey({
  userId,
  state,
  endOfMonthUnix,
}: ReservationReadKey): string {
  return endOfMonthUnix === undefined
    ? `${userId}_${state}`
    : `${userId}_${state}_${endOfMonthUnix}`;
}

// Unlike the dashboard's (userId, state) slots, which are permanent until a
// write invalidates them (see CONTEXT.md), a mentor-schedule-calendar
// month's slot can go stale from the *other* party's action - a mentee
// books a new slot, or a pending request gets accepted/rejected from
// another tab - with no local write to catch it. This bounds how stale
// "已確認"/"待您回復" can get while still eliminating the redundant
// re-fetch that would otherwise happen every time the calendar swiped back
// to an already-viewed month. Moved here (from the now-deleted
// src/services/mentor-schedule/reservationsCache.ts) so the policy lives
// with the cache it governs rather than as a constant in the calendar hook.
export const MENTOR_SCHEDULE_RESERVATIONS_TTL_MS = 30_000;

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
  /**
   * Direct write, primarily for framework plumbing (initial-data hydration)
   * - prefer `update()`. `ttlMs` is for a caller using
   * `ReservationReadKey.endOfMonthUnix`-scoped keys (see
   * `MENTOR_SCHEDULE_RESERVATIONS_TTL_MS`); omit it for the default
   * permanent, invalidate-driven slot.
   */
  set(
    key: ReservationReadKey,
    value: FetchReservationsResult,
    ttlMs?: number
  ): void;
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
  /**
   * Whether a component is actively subscribed to `key` right now (i.e.
   * mounted and reading it via `subscribe()`). The write path
   * (accept/reject/cancel/create, see `reservationMutations.ts` /
   * `reservationService.ts`) uses this to decide whether an affected key
   * needs a live in-place refresh - something is watching, so dropping to
   * `invalidate()`'s `data: null` would blank a tab the mutation never
   * touched - or can simply be invalidated, since nothing is watching and
   * the next `subscribe()` will fetch fresh on its own.
   */
  hasSubscribers(key: ReservationReadKey): boolean;
  /**
   * Reset every cached entry, listener, and in-flight fetch - used in tests,
   * and in production for an account switch or a reservation mutation
   * (accept/reject/cancel) whose effects can be embedded in slots this
   * caller doesn't otherwise know how to address individually (e.g. every
   * other cached calendar month).
   */
  clear(): void;
}

export const reservationReadModel: ReservationReadModel = {
  get(key) {
    return manager.get(toCacheKey(key));
  },
  set(key, value, ttlMs) {
    manager.set(toCacheKey(key), value, ttlMs);
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
  hasSubscribers(key) {
    return manager.getListenerCount(toCacheKey(key)) > 0;
  },
  clear() {
    manager.clear();
  },
};
