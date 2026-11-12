import { ApiError } from '@/lib/apiClient';
import { mentorPoolReadManager } from '@/lib/cache/mentorPoolCache';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  RESERVATION_CONFLICT_MESSAGE,
  ReservationVersionConflictError,
} from '@/lib/reservation/reservationConflictError';
import {
  type ReservationReadKey,
  reservationReadModel,
} from '@/lib/reservation/reservationReadModel';
import { resolveCounterpartyId } from '@/lib/reservation/resolveCounterparty';
import { invalidateMentorFeedback } from '@/services/profile/feedback';
import { Reservation } from '@/types/reservation';
import type {
  SubmitReservationFeedbackRequest,
  UpdateReservationFeedbackRequest,
} from '@/types/reservationFeedback';

import {
  invalidateReservationRead,
  postReservationFeedback,
  putReservationFeedback,
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

export { RESERVATION_CONFLICT_MESSAGE, ReservationVersionConflictError };

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
  try {
    await performStatusUpdate({
      text: message,
      myUserId,
      status: 'ACCEPT',
      flowName: 'reservation_accept',
      reservation,
    });
  } catch (err) {
    if (err instanceof ReservationVersionConflictError && myUserId) {
      affectedKeys(reservation, myUserId, myRole, [
        'pending',
        'upcoming',
        'history',
      ]).forEach(invalidateReservationRead);
    }
    throw err;
  }

  // myUserId is guaranteed defined here: performStatusUpdate above already
  // throws when it's missing.
  if (!myUserId) return;

  // Optimistically remove the item from both parties' PENDING slices first,
  // then invalidate/refresh PENDING + UPCOMING across unscoped and
  // month-scoped slices.
  affectedKeys(reservation, myUserId, myRole, ['pending']).forEach((key) =>
    reservationReadModel.evictItem(key, reservation.id)
  );
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
  try {
    await performStatusUpdate({
      text,
      myUserId,
      status: 'REJECT',
      flowName: 'reservation_reject',
      reservation,
    });
  } catch (err) {
    if (err instanceof ReservationVersionConflictError && myUserId) {
      affectedKeys(reservation, myUserId, myRole, [
        'pending',
        'upcoming',
        'history',
      ]).forEach(invalidateReservationRead);
    }
    throw err;
  }

  // myUserId is guaranteed defined here: performStatusUpdate above already
  // throws when it's missing.
  if (!myUserId) return;

  // Optimistically remove the item from PENDING + UPCOMING source slices, then
  // invalidate/refresh PENDING + UPCOMING + HISTORY for both parties.
  affectedKeys(reservation, myUserId, myRole, ['pending', 'upcoming']).forEach(
    (key) => reservationReadModel.evictItem(key, reservation.id)
  );
  affectedKeys(reservation, myUserId, myRole, [
    'pending',
    'upcoming',
    'history',
  ]).forEach(invalidateReservationRead);
}

function extractBackendIsPublic(responseData: unknown): boolean | undefined {
  if (
    !responseData ||
    typeof responseData !== 'object' ||
    !('feedback' in responseData)
  ) {
    return undefined;
  }
  const { feedback } = responseData;
  if (!feedback || typeof feedback !== 'object' || !('is_public' in feedback)) {
    return undefined;
  }
  return typeof feedback.is_public === 'boolean'
    ? feedback.is_public
    : undefined;
}

export interface SubmitFeedbackParams {
  reservation: Reservation;
  myUserId: string | undefined;
  myRole: 'mentee' | 'mentor';
  payload: SubmitReservationFeedbackRequest;
}

/**
 * Submit post-meeting feedback / rating for a completed reservation (#730).
 */
export async function submitReservationFeedback({
  reservation,
  myUserId,
  myRole,
  payload,
}: SubmitFeedbackParams): Promise<void> {
  let resolvedIsPublic = true;
  try {
    if (!myUserId) {
      throw new Error('[reservationMutations] missing current user id');
    }
    const responseData = await postReservationFeedback({
      userId: myUserId,
      reservationId: reservation.id,
      body: payload,
    });
    if (extractBackendIsPublic(responseData) === false) {
      resolvedIsPublic = false;
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      if (myUserId) {
        affectedKeys(reservation, myUserId, myRole, ['history']).forEach(
          invalidateReservationRead
        );
      }
      throw new ReservationVersionConflictError();
    }
    captureFlowFailure({
      flow: 'reservation_feedback_submit',
      step: 'post_feedback',
      message:
        err instanceof Error
          ? err.message
          : 'Failed to submit reservation feedback',
    });
    throw err;
  }

  if (!myUserId) return;

  const nowUnixSeconds = Math.floor(Date.now() / 1000);
  const myHistoryKey: ReservationReadKey = {
    userId: myUserId,
    state: statesForRole(myRole).history,
  };

  for (const targetKey of reservationReadModel.getMatchingKeys(myHistoryKey)) {
    reservationReadModel.update(targetKey, (current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) => {
          if (item.id !== reservation.id) return item;
          if (payload.meeting_happened) {
            return {
              ...item,
              feedback: {
                meetingHappened: true,
                rating: {
                  rating: payload.feedback.rating,
                  content: payload.feedback.content,
                  createdAt: nowUnixSeconds,
                  updatedAt: nowUnixSeconds,
                  authorName: item.feedback?.rating?.authorName ?? null,
                  isPublic: resolvedIsPublic,
                },
                nextStep: null,
              },
            };
          }
          return {
            ...item,
            feedback: {
              meetingHappened: false,
              rating: null,
              nextStep: null,
            },
          };
        }),
      };
    });
  }

  affectedKeys(reservation, myUserId, myRole, ['history']).forEach(
    invalidateReservationRead
  );

  if (payload.meeting_happened) {
    mentorPoolReadManager.clear();
    const counterpartyId = Number(resolveCounterpartyId(reservation, myUserId));
    invalidateMentorFeedback(
      Number.isFinite(counterpartyId) && counterpartyId > 0
        ? counterpartyId
        : undefined
    );
  }
}

export interface UpdateFeedbackParams {
  reservation: Reservation;
  myUserId: string | undefined;
  myRole: 'mentee' | 'mentor';
  payload: UpdateReservationFeedbackRequest;
}

/**
 * Update an existing post-meeting feedback / rating (#731).
 * Preserves the original `isPublic` status, `meetingHappened` lock, and `createdAt` sort position.
 */
export async function updateReservationFeedback({
  reservation,
  myUserId,
  myRole,
  payload,
}: UpdateFeedbackParams): Promise<void> {
  let backendIsPublic: boolean | undefined;
  try {
    if (!myUserId) {
      throw new Error('[reservationMutations] missing current user id');
    }
    const responseData = await putReservationFeedback({
      userId: myUserId,
      reservationId: reservation.id,
      body: payload,
    });
    backendIsPublic = extractBackendIsPublic(responseData);
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      if (myUserId) {
        affectedKeys(reservation, myUserId, myRole, ['history']).forEach(
          invalidateReservationRead
        );
      }
      throw new ReservationVersionConflictError();
    }
    captureFlowFailure({
      flow: 'reservation_feedback_edit',
      step: 'put_feedback',
      message:
        err instanceof Error
          ? err.message
          : 'Failed to update reservation feedback',
    });
    throw err;
  }

  if (!myUserId) return;

  const nowUnixSeconds = Math.floor(Date.now() / 1000);
  const fallbackIsPublic =
    backendIsPublic ?? reservation.feedback?.rating?.isPublic ?? true;
  const myHistoryKey: ReservationReadKey = {
    userId: myUserId,
    state: statesForRole(myRole).history,
  };

  for (const targetKey of reservationReadModel.getMatchingKeys(myHistoryKey)) {
    reservationReadModel.update(targetKey, (current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) => {
          if (item.id !== reservation.id) return item;
          const existingFeedback = item.feedback ?? reservation.feedback;
          const existingRating = existingFeedback?.rating;
          const preservedIsPublic =
            backendIsPublic ?? existingRating?.isPublic ?? fallbackIsPublic;

          return {
            ...item,
            feedback: {
              meetingHappened: existingFeedback?.meetingHappened ?? true,
              rating: {
                rating: payload.rating,
                content: payload.content,
                createdAt: existingRating?.createdAt ?? nowUnixSeconds,
                updatedAt: nowUnixSeconds,
                authorName: existingRating?.authorName ?? null,
                isPublic: preservedIsPublic,
              },
              nextStep: null,
            },
          };
        }),
      };
    });
  }

  affectedKeys(reservation, myUserId, myRole, ['history']).forEach(
    invalidateReservationRead
  );

  if (fallbackIsPublic !== false) {
    mentorPoolReadManager.clear();
    const counterpartyId = Number(resolveCounterpartyId(reservation, myUserId));
    invalidateMentorFeedback(
      Number.isFinite(counterpartyId) && counterpartyId > 0
        ? counterpartyId
        : undefined
    );
  }
}
