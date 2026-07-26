import { Reservation } from '@/components/reservation/types';
import { ListKey } from '@/hooks/user/reservation/useReservationData';
import { trackEvent } from '@/lib/analytics';
import { captureFlowFailure } from '@/lib/monitoring';

import { updateReservationStatus } from './index';

export type Variant =
  | 'upcoming'
  | 'pending-mentee'
  | 'pending-mentor'
  | 'history';

export const ACCEPT_AFFECTED_TABS: ListKey[] = ['pending', 'upcoming'];

/**
 * Resolve the other party's user_id based on who is currently logged in.
 */
export const resolveOtherId = (
  it: Reservation,
  myUserId: string
): string | number =>
  String(it.senderUserId) === myUserId ? it.participantUserId : it.senderUserId;

/**
 * Reject / cancel always lands the reservation in the role's HISTORY list.
 * The source state depends on the variant.
 */
export const buildRejectOrCancelAffectedTabs = (
  variant: Variant
): ListKey[] => {
  const sourceTab: ListKey | null =
    variant === 'upcoming'
      ? 'upcoming'
      : variant === 'pending-mentor' || variant === 'pending-mentee'
        ? 'pending'
        : null;
  return sourceTab ? [sourceTab, 'history'] : [];
};

interface PerformStatusUpdateParams {
  id: string;
  myUserId: string;
  status: 'ACCEPT' | 'REJECT';
  messages: { user_id: number; content: string }[];
  reservation: Reservation;
}

/**
 * Common internal helper to perform reservation status updates
 */
async function performStatusUpdate({
  id,
  myUserId,
  status,
  messages,
  reservation,
}: PerformStatusUpdateParams): Promise<void> {
  if (!myUserId) {
    throw new Error('[reservationMutations] missing current user id');
  }
  const myIdNum = Number(myUserId);
  const otherIdNum = Number(resolveOtherId(reservation, myUserId));

  await updateReservationStatus({
    userId: myUserId,
    reservationId: id,
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
}

export interface AcceptParams {
  id: string;
  message: string;
  reservation: Reservation;
  myUserId: string;
}

/**
 * Accept a booking request (mentor side, pending-mentor variant)
 */
export async function acceptReservation({
  id,
  message,
  reservation,
  myUserId,
}: AcceptParams): Promise<{ affectedTabs: ListKey[] }> {
  try {
    const myIdNum = Number(myUserId);
    const messages = message.trim()
      ? [{ user_id: myIdNum, content: message.trim() }]
      : [];

    await performStatusUpdate({
      id,
      myUserId,
      status: 'ACCEPT',
      messages,
      reservation,
    });

    return { affectedTabs: ACCEPT_AFFECTED_TABS };
  } catch (err) {
    captureFlowFailure({
      flow: 'reservation_accept',
      step: 'update_status',
      message:
        err instanceof Error ? err.message : 'Failed to accept reservation',
    });
    throw err;
  }
}

export interface RejectOrCancelParams {
  id: string;
  text: string;
  reservation: Reservation;
  myUserId: string;
  variant: Variant;
}

/**
 * Shared handler for both reject and cancel (same API call)
 */
export async function rejectOrCancelReservation({
  id,
  text,
  reservation,
  myUserId,
  variant,
}: RejectOrCancelParams): Promise<{ affectedTabs: ListKey[] }> {
  try {
    const myIdNum = Number(myUserId);
    const messages = text.trim()
      ? [{ user_id: myIdNum, content: text.trim() }]
      : [];

    await performStatusUpdate({
      id,
      myUserId,
      status: 'REJECT',
      messages,
      reservation,
    });

    trackEvent({ name: 'reservation_rejected', feature: 'reservation' });
    return { affectedTabs: buildRejectOrCancelAffectedTabs(variant) };
  } catch (err) {
    captureFlowFailure({
      flow: 'reservation_reject',
      step: 'update_status',
      message:
        err instanceof Error
          ? err.message
          : 'Failed to reject/cancel reservation',
    });
    throw err;
  }
}
