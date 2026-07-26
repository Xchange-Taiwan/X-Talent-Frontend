import { captureFlowFailure } from '@/lib/monitoring';
import { Reservation } from '@/services/reservations/types';

import { resolveOtherId, updateReservationStatus } from './reservationService';

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
    const otherIdNum = Number(resolveOtherId(reservation, myUserId));
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
      },
    });
  } catch (err) {
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
