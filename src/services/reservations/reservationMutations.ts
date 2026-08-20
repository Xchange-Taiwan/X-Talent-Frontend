import { ApiError } from '@/lib/apiClient';
import { captureFlowFailure } from '@/lib/monitoring';
import { resolveCounterpartyId } from '@/lib/reservation/resolveCounterparty';
import { Reservation } from '@/types/reservation';

import { updateReservationStatus } from './reservationService';

export const RESERVATION_CONFLICT_MESSAGE =
  '資料已被更新，請重新確認後再試一次';

/**
 * Thrown when the backend rejects a status update with 409 (optimistic-lock
 * version mismatch) — the reservation was changed elsewhere since it was
 * read. Distinguishable via `instanceof` so callers can refetch + show a
 * specific message instead of the generic failure toast.
 */
export class ReservationVersionConflictError extends Error {
  constructor() {
    super('Reservation version conflict (409)');
    this.name = 'ReservationVersionConflictError';
  }
}

/**
 * Resolve the user-facing error message for a reservation status-update
 * failure (accept/reject/cancel). Single place so every confirm dialog's
 * `errorMessage` special-cases `ReservationVersionConflictError` the same
 * way instead of repeating the same `instanceof` check per dialog.
 */
export function getReservationErrorMessage(
  error: unknown,
  fallbackMessage: string
): string {
  return error instanceof ReservationVersionConflictError
    ? RESERVATION_CONFLICT_MESSAGE
    : fallbackMessage;
}

interface PerformStatusUpdateParams {
  text: string;
  myUserId: string | undefined;
  status: 'ACCEPT' | 'REJECT';
  flowName: 'reservation_accept' | 'reservation_reject';
  reservation: Reservation;
}

/**
 * Common internal helper to perform reservation status updates, Sentry monitoring, and payload construction
 */
async function performStatusUpdate({
  text,
  myUserId,
  status,
  flowName,
  reservation,
}: PerformStatusUpdateParams): Promise<void> {
  try {
    if (!myUserId) {
      throw new Error('[reservationMutations] missing current user id');
    }
    const myIdNum = Number(myUserId);
    const otherIdNum = Number(resolveCounterpartyId(reservation, myUserId));
    const messages = text.trim()
      ? [{ user_id: myIdNum, content: text.trim() }]
      : [];

    await updateReservationStatus({
      userId: myUserId,
      reservationId: reservation.id,
      body: {
        my_user_id: myIdNum,
        user_id: otherIdNum,
        my_status: status,
        schedule_id: reservation.scheduleId,
        dtstart: reservation.dtstart,
        dtend: reservation.dtend,
        messages,
        version: reservation.version,
      },
    });
  } catch (err) {
    // A 409 here means someone else changed this reservation since we read
    // it (optimistic-lock version mismatch) — an expected concurrency
    // outcome, not a bug, so skip the Sentry capture and let the caller
    // refetch + reprompt instead.
    if (err instanceof ApiError && err.status === 409) {
      throw new ReservationVersionConflictError();
    }
    captureFlowFailure({
      flow: flowName,
      step: 'update_status',
      message:
        err instanceof Error
          ? err.message
          : `Failed to execute ${flowName} status update`,
    });
    throw err;
  }
}

export interface AcceptParams {
  message: string;
  reservation: Reservation;
  myUserId: string | undefined;
}

/**
 * Accept a booking request (mentor side, pending-mentor variant)
 */
export async function acceptReservation({
  message,
  reservation,
  myUserId,
}: AcceptParams): Promise<void> {
  await performStatusUpdate({
    text: message,
    myUserId,
    status: 'ACCEPT',
    flowName: 'reservation_accept',
    reservation,
  });
}

export interface RejectOrCancelParams {
  text: string;
  reservation: Reservation;
  myUserId: string | undefined;
}

/**
 * Shared handler for both reject and cancel (same API call)
 */
export async function rejectOrCancelReservation({
  text,
  reservation,
  myUserId,
}: RejectOrCancelParams): Promise<void> {
  await performStatusUpdate({
    text,
    myUserId,
    status: 'REJECT',
    flowName: 'reservation_reject',
    reservation,
  });
}
