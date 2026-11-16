import {
  type AsyncCacheSnapshot,
  AsyncReadManager,
  type AsyncReadResult,
} from '@/lib/asyncReadManager';
import type { ReservationState } from '@/services/reservations';
import type { Reservation } from '@/types/reservation';

export interface FetchReservationsResult {
  items: Reservation[];
  next_dtend: number;
}

/** One cache entry per signed-in user *and* reservation state, optionally
 * scoped to a calendar-month boundary (`endOfMonthUnix`). Callers never
 * build or see the underlying string key. */
export interface ReservationReadKey {
  userId: string;
  state: ReservationState;
  /** Optional upper-bound unix timestamp used by the mentor-schedule
   * calendar to scope a read to one calendar month. Omit for the reservation
   * dashboard's unscoped (all-future / all-history) pages. */
  endOfMonthUnix?: number;
}

/**
 * TTL for `endOfMonthUnix`-scoped reservation slots (the mentor-schedule
 * calendar). Unlike the reservation dashboard, which only transitions via
 * mutations on the same page, a mentor's calendar slots can go stale from
 * the *other* party's action (a mentee books a new slot, or a pending
 * request gets accepted/rejected from another tab) with no local write to
 * catch it — so those slots expire on their own.
 */
export const MENTOR_SCHEDULE_RESERVATIONS_TTL_MS = 30_000;

export type ReservationFetcher = (
  signal: AbortSignal
) => Promise<FetchReservationsResult>;

export type ReservationPageFetcher = (
  cursor: number,
  signal: AbortSignal
) => Promise<FetchReservationsResult>;

export type ReservationRefreshFetcher = (
  targetKey: ReservationReadKey,
  signal: AbortSignal
) => Promise<FetchReservationsResult>;

export interface ReservationReadOptions {
  force?: boolean;
  initialData?: FetchReservationsResult;
  /** Per-subscription staleness window. Omit for the default permanent
   * (invalidate-driven) slot; pass `MENTOR_SCHEDULE_RESERVATIONS_TTL_MS` for
   * month-scoped calendar reads. */
  ttlMs?: number;
}

const manager = new AsyncReadManager<string, FetchReservationsResult>();

interface PaginationInflightEntry {
  cursor: number;
  controller: AbortController;
  promise: Promise<FetchReservationsResult | null>;
}

const paginationInflight = new Map<string, PaginationInflightEntry>();

const toCacheKey = (key: ReservationReadKey): string =>
  key.endOfMonthUnix !== undefined
    ? `${key.userId}_${key.state}_m_${key.endOfMonthUnix}`
    : `${key.userId}_${key.state}`;

// Tracks active/cached keys so unscoped writes (`evictItem`, `patchItem`,
// `invalidate`, `invalidateOrRefresh`) can locate all month-scoped slices
// (`endOfMonthUnix`) belonging to the same `(userId, state)` without leaking
// internal key enumeration onto the public interface.
const knownKeys = new Map<string, ReservationReadKey>();

const trackKey = (key: ReservationReadKey): string => {
  const ck = toCacheKey(key);
  knownKeys.set(ck, key);
  return ck;
};

const getMatchingKeys = (key: ReservationReadKey): ReservationReadKey[] => {
  if (key.endOfMonthUnix !== undefined) {
    return [key];
  }
  const matches: ReservationReadKey[] = [key];
  knownKeys.forEach((trackedKey) => {
    if (
      trackedKey.userId === key.userId &&
      trackedKey.state === key.state &&
      trackedKey.endOfMonthUnix !== undefined
    ) {
      matches.push(trackedKey);
    }
  });
  return matches;
};

const cancelPagination = (ck: string): void => {
  const inflight = paginationInflight.get(ck);
  if (inflight) {
    paginationInflight.delete(ck);
    inflight.controller.abort();
  }
};

/**
 * Narrow, reservation-scoped facade over a private `AsyncReadManager`
 * instance. Callers only ever pass `{ userId, state[, endOfMonthUnix] }` and
 * interact through `get` / `getSnapshot` / `set` / `subscribe` / `update` /
 * `evictItem` / `patchItem` / `loadNextPage` / `invalidate` /
 * `invalidateOrRefresh` / `clear` — the manager, its string cache keys, and
 * its subscriber/slice indexing are hidden inside this module.
 *
 * Staleness contract:
 *  - Default (no `ttlMs`): cached entries never expire on their own; they
 *    stay valid until an explicit write (`update` / `patchItem` / `evictItem` /
 *    `invalidate` / `invalidateOrRefresh`).
 *  - Scoped (`ttlMs` passed on `set` or `subscribe`): the entry expires
 *    after `ttlMs` so cross-party changes surface without a manual reload.
 */
export interface ReservationReadModel {
  /** Synchronous read of the fresh cached page for `key`, if any. */
  get(key: ReservationReadKey): FetchReservationsResult | undefined;
  /** Synchronous read of `{ value, isStale }` for SWR subscribers (`useAsyncRead`). */
  getSnapshot(
    key: ReservationReadKey
  ): AsyncCacheSnapshot<FetchReservationsResult> | undefined;
  set(
    key: ReservationReadKey,
    value: FetchReservationsResult,
    ttlMs?: number
  ): void;
  subscribe(
    key: ReservationReadKey,
    fetcher: ReservationFetcher,
    onUpdate: (result: AsyncReadResult<FetchReservationsResult>) => void,
    options?: ReservationReadOptions
  ): () => void;
  update(
    key: ReservationReadKey,
    updater: (
      current: FetchReservationsResult | undefined
    ) => FetchReservationsResult | undefined
  ): void;
  /** Optimistically evicts a single reservation by `id` from both the unscoped
   * `(userId, state)` slot and any cached month-scoped slices. */
  evictItem(key: ReservationReadKey, reservationId: string): void;
  /** Patches a single reservation by `id` in place across both the unscoped
   * `(userId, state)` slot and any cached month-scoped slices without dropping
   * loaded pages (`Pages 2..N`) or resetting `next_dtend`. */
  patchItem(
    key: ReservationReadKey,
    reservationId: string,
    patcher: (item: Reservation) => Reservation
  ): void;
  /** Appends the next cursor page onto `key`'s cached items with per-key
   * deduplication and `AbortSignal` cancellation on `clear()` / superseding
   * writes. Resolves `null` when no further page exists or when aborted. */
  loadNextPage(
    key: ReservationReadKey,
    fetchPage: ReservationPageFetcher
  ): Promise<FetchReservationsResult | null>;
  invalidate(key: ReservationReadKey): void;
  /** Drops unsubscribed slices immediately (0 network calls) and refreshes
   * actively subscribed slices in place through `AsyncReadManager.refresh`
   * so `clear()` (e.g. account switch) aborts in-flight refreshes cleanly. */
  invalidateOrRefresh(
    key: ReservationReadKey,
    fetcher: ReservationRefreshFetcher
  ): Promise<void>;
  clear(): void;
}

export const reservationReadModel: ReservationReadModel = {
  get(key) {
    return manager.get(toCacheKey(key));
  },
  getSnapshot(key) {
    return manager.getSnapshot(toCacheKey(key));
  },
  set(key, value, ttlMs) {
    const ck = trackKey(key);
    cancelPagination(ck);
    manager.set(ck, value, ttlMs);
  },
  subscribe(key, fetcher, onUpdate, options) {
    const ck = trackKey(key);
    const unsub = manager.subscribe(ck, fetcher, onUpdate, options);
    return () => {
      unsub();
      if (manager.getListenerCount(ck) === 0 && !manager.has(ck)) {
        knownKeys.delete(ck);
      }
    };
  },
  update(key, updater) {
    const ck = trackKey(key);
    cancelPagination(ck);
    manager.update(ck, updater);
  },
  evictItem(key, reservationId) {
    for (const targetKey of getMatchingKeys(key)) {
      const ck = toCacheKey(targetKey);
      const current = manager.get(ck);
      if (!current || !current.items.some((it) => it.id === reservationId)) {
        continue;
      }
      manager.update(
        ck,
        (curr) =>
          curr
            ? {
                ...curr,
                items: curr.items.filter((it) => it.id !== reservationId),
              }
            : undefined,
        targetKey.endOfMonthUnix !== undefined
          ? MENTOR_SCHEDULE_RESERVATIONS_TTL_MS
          : undefined
      );
    }
  },
  patchItem(key, reservationId, patcher) {
    for (const targetKey of getMatchingKeys(key)) {
      const ck = toCacheKey(targetKey);
      const current = manager.get(ck);
      if (!current || !current.items.some((it) => it.id === reservationId)) {
        continue;
      }
      manager.update(
        ck,
        (curr) => {
          if (!curr) return undefined;
          let changed = false;
          const nextItems = curr.items.map((it) => {
            if (it.id !== reservationId) return it;
            changed = true;
            return patcher(it);
          });
          return changed ? { ...curr, items: nextItems } : undefined;
        },
        targetKey.endOfMonthUnix !== undefined
          ? MENTOR_SCHEDULE_RESERVATIONS_TTL_MS
          : undefined
      );
    }
  },
  loadNextPage(key, fetchPage) {
    const ck = toCacheKey(key);
    const current = manager.get(ck);
    if (!current || current.next_dtend === 0) {
      return Promise.resolve(null);
    }

    const cursor = current.next_dtend;
    const existing = paginationInflight.get(ck);
    if (existing && existing.cursor === cursor) {
      return existing.promise;
    }
    cancelPagination(ck);

    const controller = new AbortController();
    const cleanupInflight = (): void => {
      if (paginationInflight.get(ck)?.controller === controller) {
        paginationInflight.delete(ck);
      }
    };

    const promise = new Promise<FetchReservationsResult | null>(
      (resolve, reject) => {
        const onAbort = (): void => {
          cleanupInflight();
          resolve(null);
        };

        controller.signal.addEventListener('abort', onAbort, { once: true });

        let rawPagePromise: Promise<FetchReservationsResult>;
        try {
          rawPagePromise = Promise.resolve(
            fetchPage(cursor, controller.signal)
          );
        } catch (syncErr) {
          rawPagePromise = Promise.reject(syncErr);
        }

        rawPagePromise.then(
          (page) => {
            controller.signal.removeEventListener('abort', onAbort);
            cleanupInflight();
            if (controller.signal.aborted) {
              resolve(null);
              return;
            }
            const latest = manager.get(ck);
            if (!latest || latest.next_dtend !== cursor) {
              resolve(null);
              return;
            }
            const existingIds = new Set(latest.items.map((it) => it.id));
            const appendedItems = page.items.filter(
              (it) => !existingIds.has(it.id)
            );
            const nextValue: FetchReservationsResult = {
              items: [...latest.items, ...appendedItems],
              next_dtend: page.next_dtend,
            };
            trackKey(key);
            manager.set(
              ck,
              nextValue,
              key.endOfMonthUnix !== undefined
                ? MENTOR_SCHEDULE_RESERVATIONS_TTL_MS
                : undefined
            );
            resolve(nextValue);
          },
          (err) => {
            controller.signal.removeEventListener('abort', onAbort);
            cleanupInflight();
            if (controller.signal.aborted) {
              resolve(null);
              return;
            }
            reject(err);
          }
        );
      }
    );

    if (!controller.signal.aborted) {
      paginationInflight.set(ck, { cursor, controller, promise });
    }
    return promise;
  },
  invalidate(key) {
    for (const targetKey of getMatchingKeys(key)) {
      const ck = toCacheKey(targetKey);
      cancelPagination(ck);
      manager.invalidate(ck);
      if (manager.getListenerCount(ck) === 0) {
        knownKeys.delete(ck);
      }
    }
  },
  async invalidateOrRefresh(key, fetcher) {
    const refreshes: Promise<unknown>[] = [];
    for (const targetKey of getMatchingKeys(key)) {
      const ck = toCacheKey(targetKey);
      cancelPagination(ck);
      if (manager.getListenerCount(ck) > 0) {
        trackKey(targetKey);
        refreshes.push(
          manager.refresh(
            ck,
            (signal) => fetcher(targetKey, signal),
            targetKey.endOfMonthUnix !== undefined
              ? { ttlMs: MENTOR_SCHEDULE_RESERVATIONS_TTL_MS }
              : undefined
          )
        );
      } else {
        manager.invalidate(ck);
        knownKeys.delete(ck);
      }
    }
    await Promise.all(refreshes);
  },
  clear() {
    const activePaginations = Array.from(paginationInflight.values());
    paginationInflight.clear();
    activePaginations.forEach((entry) => entry.controller.abort());
    knownKeys.clear();
    manager.clear();
  },
};
