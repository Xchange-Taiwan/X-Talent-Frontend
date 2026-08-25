import { createKeyedCache } from '@/lib/createKeyedCache';
import type { ReservationState } from '@/services/reservations';
import type { Reservation } from '@/types/reservation';

// Unlike scheduleCache (which caches the mentor's own draft slots and can be
// trusted indefinitely within a session), a reservation's status can change
// from the *other* party's action at any moment - a mentee books a new slot,
// or a pending request gets accepted/rejected from another tab. A short TTL
// bounds how stale "已確認"/"待您回復" can get while still eliminating the
// redundant re-fetch that used to happen every time the calendar swiped back
// to an already-viewed month.
const RESERVATIONS_TTL_MS = 30_000;

const reservationsCache = createKeyedCache<string, Reservation[]>();

function cacheKey(
  userId: string,
  state: ReservationState,
  endOfMonthUnix: number
): string {
  return `${userId}:${state}:${endOfMonthUnix}`;
}

export function getCachedReservations(
  userId: string,
  state: ReservationState,
  endOfMonthUnix: number
): Reservation[] | undefined {
  return reservationsCache.get(cacheKey(userId, state, endOfMonthUnix));
}

export function cacheReservations(
  userId: string,
  state: ReservationState,
  endOfMonthUnix: number,
  items: Reservation[]
): void {
  reservationsCache.set(
    cacheKey(userId, state, endOfMonthUnix),
    items,
    RESERVATIONS_TTL_MS
  );
}

/** Full wipe on account switch - mirrors scheduleCache.clear() at the same call site. */
export function clearReservationsCache(): void {
  reservationsCache.clear();
}
