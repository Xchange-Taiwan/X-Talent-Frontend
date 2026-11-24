import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

import { apiClient, ApiError } from '@/lib/apiClient';
import { isAbortError } from '@/lib/errorUtils';
import { mentorFeedbackReadModel } from '@/lib/feedback/mentorFeedbackReadModel';
import { mentorPoolReadModel } from '@/lib/mentor/mentorPoolReadModel';
import {
  type ScheduleReadKey,
  scheduleReadModel,
} from '@/lib/mentor-schedule/scheduleReadModel';
import { captureFlowFailure } from '@/lib/monitoring';
import { profileReadModel } from '@/lib/profile/profileReadModel';
import { feedbackSessionCoordinator } from '@/lib/reservation/feedbackSessionCoordinator';
import {
  extractBackendIsPublic,
  extractBackendMeetingHappened,
  extractBackendMyMeetingHappened,
} from '@/lib/reservation/mapReservationFeedbackDto';
import {
  RESERVATION_CONFLICT_MESSAGE,
  ReservationVersionConflictError,
} from '@/lib/reservation/reservationConflictError';
import {
  resolveCounterpartyId,
  resolveTargetMentorId,
} from '@/lib/reservation/reservationProjection';
import {
  type ReservationReadKey,
  reservationReadModel,
} from '@/lib/reservation/reservationReadModel';
import { loadMonthSchedule } from '@/services/mentor-schedule/sync';
import type { components } from '@/types/api';
import type { Reservation } from '@/types/reservation';
import type {
  SubmitReservationFeedbackRequest,
  UpdateReservationFeedbackRequest,
} from '@/types/reservationFeedback';

import {
  fetchAllReservationsForState,
  fetchReservations,
  type ReservationState,
} from './reservationService';

dayjs.extend(utc);

export { RESERVATION_CONFLICT_MESSAGE, ReservationVersionConflictError };

export type ReservationRole = 'mentee' | 'mentor';
type ReservationPhase = 'pending' | 'upcoming' | 'history';

/* ============================================================================
 * 1. Write Transport Port & Adapters
 * ========================================================================== */

export type UpdateReservationDTOWithVersion =
  components['schemas']['UpdateReservationDTO'] & {
    version?: number;
  };

export interface CreateReservationTransportInput {
  userId: string | number;
  body: components['schemas']['ReservationDTO'];
}

export interface UpdateReservationStatusTransportInput {
  userId: string | number;
  reservationId: string | number;
  body: UpdateReservationDTOWithVersion;
}

export interface SubmitReservationFeedbackTransportInput {
  userId: string | number;
  reservationId: string | number;
  body: SubmitReservationFeedbackRequest;
}

export interface UpdateReservationFeedbackTransportInput {
  userId: string | number;
  reservationId: string | number;
  body: UpdateReservationFeedbackRequest;
}

export interface ReservationWriteTransport {
  createReservation(
    opts: CreateReservationTransportInput
  ): Promise<components['schemas']['ReservationVO']>;
  updateStatus(
    opts: UpdateReservationStatusTransportInput
  ): Promise<components['schemas']['ReservationVO']>;
  submitFeedback(
    opts: SubmitReservationFeedbackTransportInput
  ): Promise<unknown>;
  updateFeedback(
    opts: UpdateReservationFeedbackTransportInput
  ): Promise<unknown>;
}

export interface InMemoryReservationWriteCalls {
  createReservation: CreateReservationTransportInput[];
  updateStatus: UpdateReservationStatusTransportInput[];
  submitFeedback: SubmitReservationFeedbackTransportInput[];
  updateFeedback: UpdateReservationFeedbackTransportInput[];
}

export interface InMemoryReservationWriteTransport extends ReservationWriteTransport {
  readonly calls: InMemoryReservationWriteCalls;
}

export const defaultReservationWriteTransport: ReservationWriteTransport = {
  async createReservation({ userId, body }) {
    const path = `/v1/users/${userId}/reservations`;
    const data = await apiClient.postUnwrapped<
      components['schemas']['ReservationVO']
    >(path, body);
    if (!data) {
      throw new Error('API error: missing data in response');
    }
    return data;
  },
  async updateStatus({ userId, reservationId, body }) {
    const path = `/v1/users/${userId}/reservations/${reservationId}`;
    const data = await apiClient.putUnwrapped<
      components['schemas']['ReservationVO']
    >(path, body);
    if (!data) {
      throw new Error('API error: missing data in response');
    }
    return data;
  },
  submitFeedback({ userId, reservationId, body }) {
    const path = `/v1/users/${encodeURIComponent(userId)}/reservations/${encodeURIComponent(reservationId)}/feedback`;
    return apiClient.postUnwrapped<unknown>(path, body);
  },
  updateFeedback({ userId, reservationId, body }) {
    const path = `/v1/users/${encodeURIComponent(userId)}/reservations/${encodeURIComponent(reservationId)}/feedback`;
    return apiClient.putUnwrapped<unknown>(path, body);
  },
};

export function createInMemoryReservationWriteTransport(
  overrides: Partial<ReservationWriteTransport> = {}
): InMemoryReservationWriteTransport {
  let nextGeneratedId = 1;
  const calls: InMemoryReservationWriteCalls = {
    createReservation: [],
    updateStatus: [],
    submitFeedback: [],
    updateFeedback: [],
  };

  return {
    calls,
    async createReservation(opts) {
      calls.createReservation.push(opts);
      if (overrides.createReservation) {
        return overrides.createReservation(opts);
      }
      const generatedId = nextGeneratedId++;
      return {
        id: generatedId,
        user_id: opts.body.user_id,
        my_user_id: opts.body.my_user_id ?? Number(opts.userId),
        schedule_id: opts.body.schedule_id,
        dtstart: opts.body.dtstart,
        dtend: opts.body.dtend,
        status: opts.body.my_status ?? 'PENDING',
        my_status: opts.body.my_status ?? 'PENDING',
        messages: opts.body.messages ?? [],
        previous_reserve: opts.body.previous_reserve ?? null,
      };
    },
    async updateStatus(opts) {
      calls.updateStatus.push(opts);
      if (overrides.updateStatus) {
        return overrides.updateStatus(opts);
      }
      const parsedId = Number(opts.reservationId);
      return {
        id: Number.isFinite(parsedId) ? parsedId : null,
        user_id: opts.body.user_id,
        my_user_id: opts.body.my_user_id ?? Number(opts.userId),
        schedule_id: opts.body.schedule_id,
        dtstart: opts.body.dtstart,
        dtend: opts.body.dtend,
        status: opts.body.my_status ?? null,
        my_status: opts.body.my_status ?? null,
        messages: opts.body.messages ?? [],
        previous_reserve: opts.body.previous_reserve ?? null,
      };
    },
    async submitFeedback(opts) {
      calls.submitFeedback.push(opts);
      if (overrides.submitFeedback) {
        return overrides.submitFeedback(opts);
      }
      return {};
    },
    async updateFeedback(opts) {
      calls.updateFeedback.push(opts);
      if (overrides.updateFeedback) {
        return overrides.updateFeedback(opts);
      }
      return {};
    },
  };
}

/* ============================================================================
 * 2. Read-Model & Cross-Timezone Schedule Synchronization Helpers
 * ========================================================================== */

const otherRoleOf = (role: ReservationRole): ReservationRole =>
  role === 'mentee' ? 'mentor' : 'mentee';

function statesForRole(
  role: ReservationRole
): Record<ReservationPhase, ReservationState> {
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

function affectedKeys(
  reservation: Reservation,
  myUserId: string,
  myRole: ReservationRole,
  phases: readonly ReservationPhase[]
): ReservationReadKey[] {
  const otherUserId = String(resolveCounterpartyId(reservation, myUserId));
  const mine = statesForRole(myRole);
  const theirs = statesForRole(otherRoleOf(myRole));
  return phases.flatMap((phase) => [
    { userId: myUserId, state: mine[phase] },
    { userId: otherUserId, state: theirs[phase] },
  ]);
}

function refreshReservationKey(key: ReservationReadKey): Promise<void> {
  return reservationReadModel.invalidateOrRefresh(
    key,
    async (targetKey, signal) => {
      try {
        if (targetKey.endOfMonthUnix !== undefined) {
          const items = await fetchAllReservationsForState(
            targetKey.userId,
            targetKey.state,
            targetKey.endOfMonthUnix,
            signal
          );
          return { items, next_dtend: 0 };
        }
        return await fetchReservations({
          userId: targetKey.userId,
          state: targetKey.state,
          signal,
        });
      } catch (err) {
        if (!isAbortError(err, signal)) {
          captureFlowFailure({
            flow: 'reservation_mutation_invalidate',
            step: `refresh_${targetKey.state}`,
            message: err instanceof Error ? err.message : String(err),
            level: 'warning',
          });
        }
        throw err;
      }
    }
  );
}

/**
 * Synchronize the affected `(mentorId, year, month)` slice(s) in
 * `MentorScheduleReadModel` after a reservation booking or status transition.
 *
 * Computes `{ year, month }` in both `dayjs.utc(dtstart * 1000)` and local
 * `dayjs(dtstart * 1000)` and deduplicates by `${year}-${month}` so
 * cross-timezone month boundaries (e.g. UTC vs. Asia/Taipei) safely
 * synchronize both candidate month slices.
 */
async function refreshMentorScheduleForReservation(
  mentorId: string | number | undefined,
  dtstart: number | undefined
): Promise<void> {
  if (
    mentorId == null ||
    String(mentorId).trim() === '' ||
    typeof dtstart !== 'number' ||
    !Number.isFinite(dtstart) ||
    dtstart <= 0
  ) {
    return;
  }

  const userId = String(mentorId);
  const utcDate = dayjs.utc(dtstart * 1000);
  const localDate = dayjs(dtstart * 1000);

  const refsByMonth = new Map<string, ScheduleReadKey>();
  for (const date of [utcDate, localDate]) {
    const year = date.year();
    const month = date.month() + 1;
    const monthKey = `${year}-${month}`;
    if (!refsByMonth.has(monthKey)) {
      refsByMonth.set(monthKey, { userId, year, month });
    }
  }

  await Promise.all(
    Array.from(refsByMonth.values()).map((ref) =>
      scheduleReadModel.invalidateOrRefresh(ref, async (signal) => {
        try {
          return await loadMonthSchedule(ref, signal);
        } catch (err) {
          if (!isAbortError(err, signal)) {
            captureFlowFailure({
              flow: 'reservation_mutation_invalidate',
              step: 'refresh_mentor_schedule',
              message: err instanceof Error ? err.message : String(err),
              level: 'warning',
            });
          }
          throw err;
        }
      })
    )
  );
}

function invalidateMentorPublicCaches(
  targetMentorId: number | undefined
): void {
  mentorPoolReadModel.invalidateAfterMutation();
  mentorFeedbackReadModel.invalidateMentor(targetMentorId);
  if (targetMentorId !== undefined) {
    profileReadModel.invalidateUser(targetMentorId);
  }
}

/* ============================================================================
 * 3. Declarative State Transition Table & Unified Executor
 * ========================================================================== */

const FEEDBACK_BUSINESS_CONFLICT_TYPES = new Set([
  'attendance_already_reported',
  'attendance_not_allowed',
  'mentor_unavailable',
]);

function isFeedbackBusinessConflictError(err: ApiError): boolean {
  if (!err.data || typeof err.data !== 'object' || !('type' in err.data)) {
    return false;
  }
  return (
    typeof err.data.type === 'string' &&
    FEEDBACK_BUSINESS_CONFLICT_TYPES.has(err.data.type)
  );
}

export function getReservationErrorMessage(
  error: unknown,
  fallbackMessage: string
): string {
  return error instanceof ReservationVersionConflictError
    ? RESERVATION_CONFLICT_MESSAGE
    : fallbackMessage;
}

type ExistingReservationTransitionKind =
  'accept' | 'reject_or_cancel' | 'submit_feedback' | 'update_feedback';

interface ExistingReservationTransitionPolicy {
  readonly flowName:
    | 'reservation_accept'
    | 'reservation_reject'
    | 'reservation_feedback_submit'
    | 'reservation_feedback_edit';
  readonly stepName: 'update_status' | 'post_feedback' | 'put_feedback';
  readonly fallbackErrorMessage: string;
  readonly evictPhases: readonly ReservationPhase[];
  readonly refreshBothPartiesPhases: readonly ReservationPhase[];
  readonly refreshCounterpartyPhases: readonly ReservationPhase[];
  readonly conflictRefreshPhases: readonly ReservationPhase[];
  readonly syncMentorScheduleOnSuccess: boolean;
  readonly syncMentorScheduleOnConflict: boolean;
  readonly preserveFeedbackBusinessConflict: boolean;
  readonly markFeedbackSubmitted: boolean;
}

const RESERVATION_CREATE_SYNC_POLICY = {
  menteePendingState: statesForRole('mentee').pending,
  mentorPendingState: statesForRole('mentor').pending,
  syncMentorScheduleOnSuccess: true,
} as const;

const RESERVATION_TRANSITION_TABLE: Record<
  ExistingReservationTransitionKind,
  ExistingReservationTransitionPolicy
> = {
  accept: {
    flowName: 'reservation_accept',
    stepName: 'update_status',
    fallbackErrorMessage: 'Failed to execute reservation_accept status update',
    evictPhases: ['pending'],
    refreshBothPartiesPhases: ['pending', 'upcoming'],
    refreshCounterpartyPhases: [],
    conflictRefreshPhases: ['pending', 'upcoming', 'history'],
    syncMentorScheduleOnSuccess: true,
    syncMentorScheduleOnConflict: true,
    preserveFeedbackBusinessConflict: false,
    markFeedbackSubmitted: false,
  },
  reject_or_cancel: {
    flowName: 'reservation_reject',
    stepName: 'update_status',
    fallbackErrorMessage: 'Failed to execute reservation_reject status update',
    evictPhases: ['pending', 'upcoming'],
    refreshBothPartiesPhases: ['pending', 'upcoming', 'history'],
    refreshCounterpartyPhases: [],
    conflictRefreshPhases: ['pending', 'upcoming', 'history'],
    syncMentorScheduleOnSuccess: true,
    syncMentorScheduleOnConflict: true,
    preserveFeedbackBusinessConflict: false,
    markFeedbackSubmitted: false,
  },
  submit_feedback: {
    flowName: 'reservation_feedback_submit',
    stepName: 'post_feedback',
    fallbackErrorMessage: 'Failed to submit reservation feedback',
    evictPhases: [],
    refreshBothPartiesPhases: [],
    refreshCounterpartyPhases: ['history'],
    conflictRefreshPhases: ['history'],
    syncMentorScheduleOnSuccess: false,
    syncMentorScheduleOnConflict: false,
    preserveFeedbackBusinessConflict: true,
    markFeedbackSubmitted: true,
  },
  update_feedback: {
    flowName: 'reservation_feedback_edit',
    stepName: 'put_feedback',
    fallbackErrorMessage: 'Failed to update reservation feedback',
    evictPhases: [],
    refreshBothPartiesPhases: [],
    refreshCounterpartyPhases: ['history'],
    conflictRefreshPhases: ['history'],
    syncMentorScheduleOnSuccess: false,
    syncMentorScheduleOnConflict: false,
    preserveFeedbackBusinessConflict: true,
    markFeedbackSubmitted: true,
  },
};

interface ExecuteReservationTransitionOptions<TResponse> {
  kind: ExistingReservationTransitionKind;
  reservation: Reservation;
  myUserId: string | undefined;
  myRole: ReservationRole;
  runWrite: (validUserId: string) => Promise<TResponse>;
  applySuccessReconciliation?: (ctx: {
    response: TResponse;
    myUserId: string;
    myHistoryKey: ReservationReadKey;
  }) => { invalidatePublicMentorCaches: boolean };
}

async function executeReservationTransition<TResponse>({
  kind,
  reservation,
  myUserId,
  myRole,
  runWrite,
  applySuccessReconciliation,
}: ExecuteReservationTransitionOptions<TResponse>): Promise<TResponse> {
  const policy = RESERVATION_TRANSITION_TABLE[kind];

  let response: TResponse;
  try {
    if (!myUserId) {
      throw new Error('[reservationMutations] missing current user id');
    }
    response = await runWrite(myUserId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      if (myUserId) {
        const conflictMentorId = resolveTargetMentorId(
          reservation,
          myUserId,
          myRole
        );
        affectedKeys(
          reservation,
          myUserId,
          myRole,
          policy.conflictRefreshPhases
        ).forEach((key) => {
          void refreshReservationKey(key);
        });
        if (policy.syncMentorScheduleOnConflict) {
          void refreshMentorScheduleForReservation(
            conflictMentorId,
            reservation.dtstart
          );
        }
      }
      if (
        policy.preserveFeedbackBusinessConflict &&
        isFeedbackBusinessConflictError(err)
      ) {
        throw err;
      }
      throw new ReservationVersionConflictError();
    }

    captureFlowFailure({
      flow: policy.flowName,
      step: policy.stepName,
      message: err instanceof Error ? err.message : policy.fallbackErrorMessage,
    });
    throw err;
  }

  const targetMentorId = resolveTargetMentorId(reservation, myUserId, myRole);

  if (policy.evictPhases.length > 0) {
    affectedKeys(reservation, myUserId, myRole, policy.evictPhases).forEach(
      (key) => reservationReadModel.evictItem(key, reservation.id)
    );
  }

  const myHistoryKey: ReservationReadKey = {
    userId: myUserId,
    state: statesForRole(myRole).history,
  };
  const reconciliation = applySuccessReconciliation?.({
    response,
    myUserId,
    myHistoryKey,
  });

  if (policy.markFeedbackSubmitted) {
    feedbackSessionCoordinator.recordFeedbackOutcome({
      action: 'submit',
      source: 'card',
      userId: String(myUserId),
      reservationId: reservation.id,
    });
  }

  if (policy.refreshBothPartiesPhases.length > 0) {
    affectedKeys(
      reservation,
      myUserId,
      myRole,
      policy.refreshBothPartiesPhases
    ).forEach((key) => {
      void refreshReservationKey(key);
    });
  }

  if (policy.refreshCounterpartyPhases.length > 0) {
    const counterpartyUserId = String(
      resolveCounterpartyId(reservation, myUserId)
    );
    const theirs = statesForRole(otherRoleOf(myRole));
    policy.refreshCounterpartyPhases.forEach((phase) => {
      void refreshReservationKey({
        userId: counterpartyUserId,
        state: theirs[phase],
      });
    });
  }

  if (policy.syncMentorScheduleOnSuccess) {
    void refreshMentorScheduleForReservation(
      targetMentorId,
      reservation.dtstart
    );
  }

  if (reconciliation?.invalidatePublicMentorCaches) {
    invalidateMentorPublicCaches(targetMentorId);
  }

  return response;
}

function buildStatusUpdateBody(
  reservation: Reservation,
  myUserId: string,
  status: 'ACCEPT' | 'REJECT',
  text: string
): UpdateReservationDTOWithVersion {
  const myIdNum = Number(myUserId);
  const otherIdNum = Number(resolveCounterpartyId(reservation, myUserId));
  const messages = text.trim()
    ? [{ user_id: myIdNum, content: text.trim() }]
    : [];

  return {
    my_user_id: myIdNum,
    user_id: otherIdNum,
    my_status: status,
    schedule_id: reservation.scheduleId,
    dtstart: reservation.dtstart,
    dtend: reservation.dtend,
    messages,
    version: reservation.version,
  };
}

/* ============================================================================
 * 4. Public Lifecycle Mutations (5 Write Entrypoints)
 * ========================================================================== */

export interface CreateReservationParams {
  userId: string | number;
  body: components['schemas']['ReservationDTO'];
  debug?: boolean;
  transport?: ReservationWriteTransport;
}

/**
 * Create a reservation (POST /v1/users/:user_id/reservations) and synchronize
 * both parties' PENDING slices plus the target mentor's schedule month(s).
 */
export async function createReservation(
  opts: CreateReservationParams
): Promise<components['schemas']['ReservationVO']> {
  const { userId, body, transport = defaultReservationWriteTransport } = opts;

  const data = await transport.createReservation({ userId, body });

  void refreshReservationKey({
    userId: String(userId),
    state: RESERVATION_CREATE_SYNC_POLICY.menteePendingState,
  });
  void refreshReservationKey({
    userId: String(body.user_id),
    state: RESERVATION_CREATE_SYNC_POLICY.mentorPendingState,
  });
  if (RESERVATION_CREATE_SYNC_POLICY.syncMentorScheduleOnSuccess) {
    void refreshMentorScheduleForReservation(body.user_id, body.dtstart);
  }

  return data;
}

export interface AcceptParams {
  message: string;
  reservation: Reservation;
  myUserId: string | undefined;
  myRole: ReservationRole;
  transport?: ReservationWriteTransport;
}

/**
 * Accept a booking request (mentor side, pending-mentor variant)
 */
export async function acceptReservation({
  message,
  reservation,
  myUserId,
  myRole,
  transport = defaultReservationWriteTransport,
}: AcceptParams): Promise<void> {
  await executeReservationTransition({
    kind: 'accept',
    reservation,
    myUserId,
    myRole,
    runWrite: (validUserId) =>
      transport.updateStatus({
        userId: validUserId,
        reservationId: reservation.id,
        body: buildStatusUpdateBody(
          reservation,
          validUserId,
          'ACCEPT',
          message
        ),
      }),
  });
}

export interface RejectOrCancelParams {
  text: string;
  reservation: Reservation;
  myUserId: string | undefined;
  myRole: ReservationRole;
  transport?: ReservationWriteTransport;
}

/**
 * Shared handler for both reject and cancel (same API call)
 */
export async function rejectOrCancelReservation({
  text,
  reservation,
  myUserId,
  myRole,
  transport = defaultReservationWriteTransport,
}: RejectOrCancelParams): Promise<void> {
  await executeReservationTransition({
    kind: 'reject_or_cancel',
    reservation,
    myUserId,
    myRole,
    runWrite: (validUserId) =>
      transport.updateStatus({
        userId: validUserId,
        reservationId: reservation.id,
        body: buildStatusUpdateBody(reservation, validUserId, 'REJECT', text),
      }),
  });
}

export interface SubmitFeedbackParams {
  reservation: Reservation;
  myUserId: string | undefined;
  myRole: ReservationRole;
  payload: SubmitReservationFeedbackRequest;
  transport?: ReservationWriteTransport;
}

/**
 * Submit post-meeting feedback / rating for a completed reservation (#730 / #888).
 * Atomically updates/invalidates all affected client stores (`reservationReadModel`,
 * `feedbackSessionCoordinator`, `mentorPoolReadModel`, `mentorFeedbackReadModel`, and
 * `profileReadModel` across all tracked locales).
 */
export async function submitReservationFeedback({
  reservation,
  myUserId,
  myRole,
  payload,
  transport = defaultReservationWriteTransport,
}: SubmitFeedbackParams): Promise<void> {
  await executeReservationTransition({
    kind: 'submit_feedback',
    reservation,
    myUserId,
    myRole,
    runWrite: (validUserId) =>
      transport.submitFeedback({
        userId: validUserId,
        reservationId: reservation.id,
        body: payload,
      }),
    applySuccessReconciliation: ({ response, myHistoryKey }) => {
      const backendMeetingHappened = extractBackendMeetingHappened(response);
      const backendMyMeetingHappened =
        extractBackendMyMeetingHappened(response);
      const resolvedIsPublic = !(
        extractBackendIsPublic(response) === false ||
        backendMeetingHappened === false
      );
      const nowUnixSeconds = Math.floor(Date.now() / 1000);

      let hadPriorHappenedInCache =
        reservation.feedback?.meetingHappened === true;

      reservationReadModel.patchItem(myHistoryKey, reservation.id, (item) => {
        if (item.feedback?.meetingHappened === true) {
          hadPriorHappenedInCache = true;
        }
        if (payload.meeting_happened) {
          const nextMeetingHappened =
            backendMeetingHappened === false ||
            item.feedback?.meetingHappened === false ||
            reservation.feedback?.meetingHappened === false
              ? false
              : true;
          const effectiveIsPublic = nextMeetingHappened
            ? resolvedIsPublic
            : false;
          const nextRating = payload.feedback
            ? {
                rating: payload.feedback.rating,
                content: payload.feedback.content,
                createdAt: nowUnixSeconds,
                updatedAt: nowUnixSeconds,
                authorName: item.feedback?.rating?.authorName ?? null,
                isPublic: effectiveIsPublic,
              }
            : item.feedback?.rating
              ? {
                  ...item.feedback.rating,
                  isPublic: nextMeetingHappened
                    ? item.feedback.rating.isPublic
                    : false,
                }
              : null;

          return {
            ...item,
            feedback: {
              meetingHappened: nextMeetingHappened,
              myMeetingHappened:
                backendMyMeetingHappened !== undefined
                  ? backendMyMeetingHappened
                  : true,
              rating: nextRating,
              nextStep: null,
            },
          };
        }

        return {
          ...item,
          feedback: {
            meetingHappened: false,
            myMeetingHappened:
              backendMyMeetingHappened !== undefined
                ? backendMyMeetingHappened
                : false,
            rating:
              myRole === 'mentor' && item.feedback?.rating
                ? {
                    ...item.feedback.rating,
                    isPublic: false,
                  }
                : null,
            nextStep: null,
          },
        };
      });

      return {
        invalidatePublicMentorCaches: Boolean(
          payload.meeting_happened ||
          myRole === 'mentor' ||
          hadPriorHappenedInCache
        ),
      };
    },
  });
}

export interface UpdateFeedbackParams {
  reservation: Reservation;
  myUserId: string | undefined;
  myRole: ReservationRole;
  payload: UpdateReservationFeedbackRequest;
  transport?: ReservationWriteTransport;
}

/**
 * Update an existing post-meeting feedback / rating (#731 / #888).
 * Preserves `myMeetingHappened`, `isPublic`, `meetingHappened` lock, and `createdAt`
 * sort position, and atomically synchronizes all 5 client stores.
 */
export async function updateReservationFeedback({
  reservation,
  myUserId,
  myRole,
  payload,
  transport = defaultReservationWriteTransport,
}: UpdateFeedbackParams): Promise<void> {
  await executeReservationTransition({
    kind: 'update_feedback',
    reservation,
    myUserId,
    myRole,
    runWrite: (validUserId) =>
      transport.updateFeedback({
        userId: validUserId,
        reservationId: reservation.id,
        body: payload,
      }),
    applySuccessReconciliation: ({ response, myHistoryKey }) => {
      const backendIsPublic = extractBackendIsPublic(response);
      const backendMeetingHappened = extractBackendMeetingHappened(response);
      const backendMyMeetingHappened =
        extractBackendMyMeetingHappened(response);
      const nowUnixSeconds = Math.floor(Date.now() / 1000);

      const fallbackMeetingHappened =
        backendMeetingHappened ?? reservation.feedback?.meetingHappened ?? true;
      const fallbackIsPublic =
        fallbackMeetingHappened === false
          ? false
          : (backendIsPublic ?? reservation.feedback?.rating?.isPublic ?? true);
      const wasPublicOnInput =
        reservation.feedback !== undefined &&
        reservation.feedback.meetingHappened !== false &&
        reservation.feedback.rating?.isPublic !== false;

      let shouldInvalidatePublicCaches =
        fallbackIsPublic !== false || wasPublicOnInput;

      reservationReadModel.patchItem(myHistoryKey, reservation.id, (item) => {
        const existingFeedback = item.feedback ?? reservation.feedback;
        const existingRating = existingFeedback?.rating;
        const wasPublicInCache =
          existingFeedback !== undefined &&
          existingFeedback.meetingHappened !== false &&
          existingRating?.isPublic !== false;
        const preservedMeetingHappened =
          backendMeetingHappened ?? existingFeedback?.meetingHappened ?? true;
        const preservedMyMeetingHappened =
          backendMyMeetingHappened !== undefined
            ? backendMyMeetingHappened
            : existingFeedback?.myMeetingHappened;
        const preservedIsPublic =
          preservedMeetingHappened === false
            ? false
            : (backendIsPublic ?? existingRating?.isPublic ?? fallbackIsPublic);

        if (preservedIsPublic !== false || wasPublicInCache) {
          shouldInvalidatePublicCaches = true;
        }

        return {
          ...item,
          feedback: {
            meetingHappened: preservedMeetingHappened,
            ...(preservedMyMeetingHappened !== undefined
              ? { myMeetingHappened: preservedMyMeetingHappened }
              : {}),
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
      });

      return {
        invalidatePublicMentorCaches: shouldInvalidatePublicCaches,
      };
    },
  });
}
