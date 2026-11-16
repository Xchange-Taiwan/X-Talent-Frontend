export const RESERVATION_CONFLICT_MESSAGE =
  '資料已被更新，請重新確認後再試一次';

/**
 * Thrown when the backend rejects a reservation mutation with 409
 * (optimistic-lock version mismatch or duplicate feedback submission) — the
 * reservation was changed elsewhere since it was read. Distinguishable via
 * `instanceof` so callers can refetch + show a specific message instead of a
 * generic retry toast.
 */
export class ReservationVersionConflictError extends Error {
  constructor() {
    super('Reservation version conflict (409)');
    this.name = 'ReservationVersionConflictError';
  }
}
