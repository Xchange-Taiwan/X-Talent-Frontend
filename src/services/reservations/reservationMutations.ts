import { ApiError } from '@/lib/apiClient';
import { captureFlowFailure } from '@/lib/monitoring';
import type { ReservationReadKey } from '@/lib/reservation/reservationReadModel';
import { resolveCounterpartyId } from '@/lib/reservation/resolveCounterparty';
import { Reservation } from '@/types/reservation';

import {
  invalidateReservationRead,
  type ReservationState,
  updateReservationStatus,
} from './reservationService';

type ReservationRole = 'mentee' | 'mentor';

const otherRoleOf = (role: ReservationRole): ReservationRole =>
  role === 'mentee' ? 'mentor' : 'mentee';

/** The three (or, for accept, two) `{ userId, state }` reads a role's own
 * tabs can hold - the read-model keys the write path invalidates below. */
function statesForRole(role: ReservationRole): {
  pending: ReservationState;
  upcoming: ReservationState;
  history: ReservationState;
} {
  return role === 'mentee'
    ? {
        pending: 'MENTEE_PENDING',
        upcoming: 'MENTEE_UPCOMING',
        history: 'MENTEE_HISTORY',
      }
    : {
        pending: 'MENTOR_PENDING',
        upcoming: 'MENTOR_UPCOMING',
        history: 'MENTOR_HISTORY',
      };
}

/**
 * Every affected `{ userId, state }` key for both parties to `reservation`,
 * given which role `myUserId` occupies in it - the counterparty always
 * occupies the opposite role. `phases` picks which of that role's states
 * actually changed (accept only touches pending/upcoming; reject/cancel
 * also touches history).
 */
function affectedKeys(
  reservation: Reservation,
  myUserId: string,
  myRole: ReservationRole,
  phases: Array<'pending' | 'upcoming' | 'history'>
): ReservationReadKey[] {
  const otherUserId = String(resolveCounterpartyId(reservation, myUserId));
  const mine = statesForRole(myRole);
  const theirs = statesForRole(otherRoleOf(myRole));
  return phases.flatMap((phase) => [
    { userId: myUserId, state: mine[phase] },
    { userId: otherUserId, state: theirs[phase] },
  ]);
}

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
  /** Which side `myUserId` is acting as for this reservation - determines
   * which of the two parties' cache slots get invalidated after a
   * successful accept. */
  myRole: 'mentee' | 'mentor';
}

/**
 * Accept a booking request (mentor side, pending-mentor variant)
 */
export async function acceptReservation({
  message,
  reservation,
  myUserId,
  myRole,
}: AcceptParams): Promise<void> {
  await performStatusUpdate({
    text: message,
    myUserId,
    status: 'ACCEPT',
    flowName: 'reservation_accept',
    reservation,
  });

  // myUserId is guaranteed defined here: performStatusUpdate above already
  // throws when it's missing.
  if (!myUserId) return;

  // Accept moves the reservation out of PENDING and into UPCOMING for both
  // parties - see invalidateReservationRead.
  affectedKeys(reservation, myUserId, myRole, ['pending', 'upcoming']).forEach(
    invalidateReservationRead
  );
}

export interface RejectOrCancelParams {
  text: string;
  reservation: Reservation;
  myUserId: string | undefined;
  /** Which side `myUserId` is acting as for this reservation - determines
   * which of the two parties' cache slots get invalidated after a
   * successful reject/cancel. */
  myRole: 'mentee' | 'mentor';
}

/**
 * Shared handler for both reject and cancel (same API call)
 */
export async function rejectOrCancelReservation({
  text,
  reservation,
  myUserId,
  myRole,
}: RejectOrCancelParams): Promise<void> {
  await performStatusUpdate({
    text,
    myUserId,
    status: 'REJECT',
    flowName: 'reservation_reject',
    reservation,
  });

  // myUserId is guaranteed defined here: performStatusUpdate above already
  // throws when it's missing.
  if (!myUserId) return;

  // A reject moves it from PENDING to HISTORY; a cancel moves it from
  // UPCOMING to HISTORY - invalidating all three covers either source
  // without needing to know which one this call was, for both parties. See
  // invalidateReservationRead.
  affectedKeys(reservation, myUserId, myRole, [
    'pending',
    'upcoming',
    'history',
  ]).forEach(invalidateReservationRead);
}
