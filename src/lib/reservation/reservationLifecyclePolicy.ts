import type { Reservation } from '@/types/reservation';
import type {
  FeedbackViewerRole,
  ReservationFeedback,
} from '@/types/reservationFeedback';

/* ============================================================================
 * 1. Pure Reservation Time-Phase Evaluation
 * ========================================================================== */

export type ReservationTimeStatus =
  'far' | 'soon' | 'imminent' | 'live' | 'ended';

export interface ReservationTimeInfo {
  status: ReservationTimeStatus;
  label: string;
}

const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

/**
 * Evaluates the temporal lifecycle phase and localized badge label of a
 * reservation from Unix second timestamps against `nowMs`.
 * Pure domain calculation with zero React/timer dependencies.
 */
export function evaluateReservationTimePhase(
  dtstartUnixSeconds: number,
  dtendUnixSeconds: number,
  nowMs: number = Date.now()
): ReservationTimeInfo {
  const startMs = dtstartUnixSeconds * 1000;
  const endMs = dtendUnixSeconds * 1000;

  if (nowMs >= endMs) return { status: 'ended', label: '已結束' };
  if (nowMs >= startMs) return { status: 'live', label: '進行中' };

  const diffMs = startMs - nowMs;

  if (diffMs >= ONE_DAY_MS) {
    const days = Math.floor(diffMs / ONE_DAY_MS);
    return { status: 'far', label: `${days} 天後` };
  }

  if (diffMs >= ONE_HOUR_MS) {
    const hours = Math.floor(diffMs / ONE_HOUR_MS);
    return { status: 'soon', label: `${hours} 小時後開始` };
  }

  if (diffMs >= ONE_MINUTE_MS) {
    const minutes = Math.floor(diffMs / ONE_MINUTE_MS);
    return { status: 'imminent', label: `${minutes} 分鐘後開始` };
  }

  return { status: 'imminent', label: '即將開始' };
}

export const computeReservationTimeInfo = evaluateReservationTimePhase;

/* ============================================================================
 * 2. Cancellation & SYSTEM 24-Hour Auto-Cancel Policy (#321 / #587)
 * ========================================================================== */

export type ReservationCancelledBy = NonNullable<Reservation['cancelledBy']>;
export type ReservationPolicyRole = FeedbackViewerRole;

const CANCELLED_BY_LABELS: Record<ReservationCancelledBy, string> = {
  MENTOR: '已由導師取消',
  MENTEE: '已由學員取消',
  SYSTEM: '已自動取消',
};

const SYSTEM_AUTO_CANCEL_COPY: Record<ReservationPolicyRole, string> = {
  mentor: '因您未於預約開始前 24 小時前確認，系統已自動取消此預約。',
  mentee: '因導師未於預約開始前 24 小時前確認，系統已自動取消此預約。',
};

export interface ResolveCancelledByInput {
  explicitCancelledBy?: string | null;
  counterpartyRole?: string | null;
  counterpartyStatus?: string | null;
  currentUserRole?: string | null;
  currentUserStatus?: string | null;
}

function toParticipantRole(
  role?: string | null
): 'MENTEE' | 'MENTOR' | undefined {
  return role === 'MENTEE' || role === 'MENTOR' ? role : undefined;
}

/**
 * Resolves who cancelled a reservation with deterministic precedence:
 * 1. Explicit `cancelled_by` (`'SYSTEM' | 'MENTOR' | 'MENTEE'`) always wins.
 *    In particular, `'SYSTEM'` represents the platform 24-hour confirmation
 *    timeout auto-cancellation (#321 / #587: mentor did not confirm a PENDING
 *    booking at least 24 hours before `dtstart`) and takes precedence over any
 *    participant status flags.
 * 2. When deriving from participant statuses (`REJECT`), the counterparty
 *    (`other side`) takes precedence over the current user when both sides are
 *    marked `REJECT` (platform business invariant).
 * 3. Otherwise falls back to the current user's role if `currentUserStatus` is
 *    `REJECT`, or `undefined` when uncancelled.
 */
export function resolveCancelledBy({
  explicitCancelledBy,
  counterpartyRole,
  counterpartyStatus,
  currentUserRole,
  currentUserStatus,
}: ResolveCancelledByInput): ReservationCancelledBy | undefined {
  if (
    explicitCancelledBy === 'SYSTEM' ||
    explicitCancelledBy === 'MENTOR' ||
    explicitCancelledBy === 'MENTEE'
  ) {
    return explicitCancelledBy;
  }

  if (counterpartyStatus === 'REJECT') {
    return toParticipantRole(counterpartyRole);
  }

  if (currentUserStatus === 'REJECT') {
    return toParticipantRole(currentUserRole);
  }

  return undefined;
}

export function isReservationCancelled(
  reservation: Pick<Reservation, 'cancelledBy'> | null | undefined
): boolean {
  return Boolean(reservation?.cancelledBy);
}

export function isSystemAutoCancelled(
  reservation: Pick<Reservation, 'cancelledBy'> | null | undefined
): boolean {
  return reservation?.cancelledBy === 'SYSTEM';
}

export function resolveCancelledByLabel(
  cancelledBy: ReservationCancelledBy | null | undefined
): string | undefined {
  if (!cancelledBy) return undefined;
  return CANCELLED_BY_LABELS[cancelledBy];
}

/**
 * Returns the role-tailored 24-hour auto-cancellation explanation banner copy
 * when `cancelledBy === 'SYSTEM'`, or `null` for active / participant-cancelled
 * reservations (#321 / #587).
 */
export function resolveSystemAutoCancelNotice(
  reservation: Pick<Reservation, 'cancelledBy'> | null | undefined,
  viewerRole: ReservationPolicyRole
): string | null {
  if (!isSystemAutoCancelled(reservation)) {
    return null;
  }
  return SYSTEM_AUTO_CANCEL_COPY[viewerRole];
}

/**
 * History cards expose the "查看完整對話" dialog trigger whenever messages exist
 * OR when `cancelledBy === 'SYSTEM'` (so users can still open the thread view
 * to inspect the 24-hour system auto-cancel notice even with zero messages).
 */
export function canOpenHistoryConversation(
  reservation: Pick<Reservation, 'messages' | 'cancelledBy'>
): boolean {
  return reservation.messages.length > 0 || isSystemAutoCancelled(reservation);
}

/* ============================================================================
 * 3. Reservation Tab Slice Filtering & Partitioning
 * ========================================================================== */

/**
 * Backend orders reservation lists by `dtend` descending (latest first), which
 * suits HISTORY, whereas UPCOMING and PENDING tabs lead with the meeting
 * closest to now (`dtstart` ascending).
 */
export function sortReservationsByDtstartAsc(
  items: readonly Reservation[]
): Reservation[] {
  return [...items].sort((a, b) => a.dtstart - b.dtstart);
}

/**
 * Filters out any cancelled (`MENTEE` / `MENTOR` / `SYSTEM`) reservations from
 * active (`upcoming` or `pending`) slices and sorts chronologically by `dtstart`.
 */
export function filterActiveTabReservations(
  items: readonly Reservation[]
): Reservation[] {
  return sortReservationsByDtstartAsc(
    items.filter((item) => !isReservationCancelled(item))
  );
}

export interface PartitionReservationTabSlicesInput {
  upcomingItems?: readonly Reservation[];
  pendingItems?: readonly Reservation[];
  historyItems?: readonly Reservation[];
}

export interface ReservationTabSlices {
  upcoming: Reservation[];
  pending: Reservation[];
  history: Reservation[];
}

/**
 * Partitions raw upcoming, pending, and history reads into clean tab slices:
 * - `upcoming` & `pending` exclude any cancelled (`cancelledBy`) items and
 *   sort ascending by `dtstart`.
 * - Any stale cancelled items still returned in `upcoming` or `pending` are
 *   immediately surfaced at the top of `history` without duplicating IDs
 *   already present in `historyItems`.
 */
export function partitionReservationTabSlices({
  upcomingItems = [],
  pendingItems = [],
  historyItems = [],
}: PartitionReservationTabSlicesInput): ReservationTabSlices {
  const upcoming = filterActiveTabReservations(upcomingItems);
  const pending = filterActiveTabReservations(pendingItems);

  const seenIds = new Set(historyItems.map((item) => item.id));
  const derivedCancelled: Reservation[] = [];

  for (const candidate of [...upcomingItems, ...pendingItems]) {
    if (isReservationCancelled(candidate) && !seenIds.has(candidate.id)) {
      seenIds.add(candidate.id);
      derivedCancelled.push(candidate);
    }
  }

  return {
    upcoming,
    pending,
    history: [...derivedCancelled, ...historyItems],
  };
}

/* ============================================================================
 * 4. PLAYBOOK [DECISION-02] Post-Session Feedback & Attendance Eligibility
 * ========================================================================== */

export type MentorOwnAttendanceState =
  'pending' | 'happened' | 'not-happened' | 'unknown';

export type FeedbackInitialStep = 'attendance' | 'rating';
export type FeedbackDialogStep = 'attendance' | 'rating' | 'not-happened';

/**
 * Resolves the effective feedback role (`'mentee' | 'mentor'`) for a dialog or
 * card surface. Rating edit mode (#731) is exclusively a Mentee capability.
 */
export function resolveEffectiveFeedbackRole(opts: {
  reservation?: Pick<Reservation, 'viewerRole'> | null;
  explicitRole?: ReservationPolicyRole;
  isEditMode?: boolean;
}): ReservationPolicyRole {
  if (opts.isEditMode) {
    return 'mentee';
  }
  if (opts.explicitRole) {
    return opts.explicitRole;
  }
  return opts.reservation?.viewerRole === 'MENTOR' ? 'mentor' : 'mentee';
}

/**
 * Resolves ONLY the Mentor's own attendance state (#735 / #760 §3.1) without
 * ever leaking the Mentee's attendance answer when Mentor left the session
 * unanswered (`myMeetingHappened === null` while `nextStep === null`).
 */
export function resolveMentorOwnAttendance(
  reservation: Pick<Reservation, 'cancelledBy' | 'feedback'> | null | undefined
): MentorOwnAttendanceState {
  if (!reservation || isReservationCancelled(reservation)) {
    return 'unknown';
  }
  const feedback: ReservationFeedback | undefined = reservation.feedback;
  if (!feedback) {
    return 'unknown';
  }
  if (feedback.nextStep === 'ANSWER') {
    return 'pending';
  }
  const ownAnswered =
    feedback.myMeetingHappened !== undefined
      ? feedback.myMeetingHappened
      : feedback.meetingHappened;
  if (ownAnswered === true) {
    return 'happened';
  }
  if (ownAnswered === false) {
    return 'not-happened';
  }
  return 'unknown';
}

/**
 * Multi-session pending feedback queue eligibility (`?feedback=queue` / #740):
 * Only uncancelled reservations awaiting initial attendance confirmation
 * (`nextStep === 'ANSWER'`) enter the queue.
 */
export function isEligibleForPendingFeedbackQueue(
  reservation: Pick<Reservation, 'cancelledBy' | 'feedback'> | null | undefined
): boolean {
  return Boolean(
    reservation &&
    !isReservationCancelled(reservation) &&
    reservation.feedback?.nextStep === 'ANSWER'
  );
}

/**
 * Determines whether the viewer can submit post-session attendance / feedback
 * (`填寫回饋` for Mentee, `確認會談` for Mentor) under `[DECISION-02]`:
 * - Cancelled reservations (`MENTEE` / `MENTOR` / `SYSTEM`) are never eligible.
 * - Mentors only confirm attendance (`nextStep === 'ANSWER'`); they never have
 *   a `RATE` step.
 * - Mentees can start at `ANSWER` or resume rating at `RATE`.
 */
export function canSubmitReservationFeedback(
  reservation: Pick<Reservation, 'cancelledBy' | 'feedback'> | null | undefined,
  role: ReservationPolicyRole
): boolean {
  if (!reservation || isReservationCancelled(reservation)) {
    return false;
  }
  const nextStep = reservation.feedback?.nextStep;
  if (role === 'mentor') {
    return nextStep === 'ANSWER';
  }
  return nextStep === 'ANSWER' || nextStep === 'RATE';
}

/**
 * `[DECISION-02]` & `#731` permanent edit rule:
 * Mentees can edit their submitted rating + content unlimited times (both
 * public ratings and unpublicized ratings where counterparty reported
 * `COUNTERPART_ABSENT` / not-happened). Mentors never edit ratings, and
 * sessions where Mentee reported not-happened (`rating === null`) stay locked.
 */
export function canEditReservationFeedback(
  reservation: Pick<Reservation, 'cancelledBy' | 'feedback'> | null | undefined,
  role: ReservationPolicyRole
): boolean {
  if (
    role !== 'mentee' ||
    !reservation ||
    isReservationCancelled(reservation)
  ) {
    return false;
  }
  if (canSubmitReservationFeedback(reservation, 'mentee')) {
    return false;
  }
  return Boolean(reservation.feedback?.rating);
}

/**
 * `[DECISION-02]` Plan A immediate publication & mutual non-denial rule (#735):
 * A Mentee's rating is visible to the Mentor immediately upon submission (even
 * while Mentor is still `pending` / `unknown`), UNLESS the reservation was
 * cancelled, either party reported the session did not happen
 * (`COUNTERPART_ABSENT`, etc. -> `meetingHappened === false` or Mentor
 * `ownAttendance === 'not-happened'`), or `rating.isPublic === false`.
 */
export function isPublicRatingVisibleToMentor(
  reservation: Pick<Reservation, 'cancelledBy' | 'feedback'> | null | undefined
): boolean {
  if (!reservation || isReservationCancelled(reservation)) {
    return false;
  }
  const ownAttendance = resolveMentorOwnAttendance(reservation);
  const rating = reservation.feedback?.rating;
  const isSessionMarkedNotHappened =
    ownAttendance === 'not-happened' ||
    reservation.feedback?.meetingHappened === false;

  return Boolean(
    !isSessionMarkedNotHappened && rating && rating.isPublic !== false
  );
}

/**
 * Whether a settled (non-pending) Mentor history card has an expandable
 * `查看紀錄` panel (either Mentor confirmed `happened` or a public Mentee
 * rating is visible). Used by both `resolveHistoryFeedbackState` and
 * `feedbackDeepLink` so deep-link auto-expand never drifts from card rendering.
 */
export function hasExpandableMentorFeedback(
  reservation: Pick<Reservation, 'cancelledBy' | 'feedback'> | null | undefined
): boolean {
  if (
    !reservation ||
    isReservationCancelled(reservation) ||
    canSubmitReservationFeedback(reservation, 'mentor')
  ) {
    return false;
  }
  const ownAttendance = resolveMentorOwnAttendance(reservation);
  return (
    ownAttendance === 'happened' || isPublicRatingVisibleToMentor(reservation)
  );
}

/**
 * Whether a settled Mentee reservation is resolved as `未進行` (no rating,
 * `meetingHappened === false`).
 */
export function isMenteeSessionMarkedNotHappened(
  reservation: Pick<Reservation, 'cancelledBy' | 'feedback'> | null | undefined
): boolean {
  if (
    !reservation ||
    isReservationCancelled(reservation) ||
    canSubmitReservationFeedback(reservation, 'mentee') ||
    reservation.feedback?.rating
  ) {
    return false;
  }
  return reservation.feedback?.meetingHappened === false;
}

/**
 * Resolves the canonical initial step (`'attendance' | 'rating'`) when opening
 * `MeetingFeedbackDialog`:
 * - Edit mode (#731) always opens `'rating'`.
 * - Mentor role ALWAYS opens `'attendance'` (`[DECISION-02]`: Mentor 2-page
 *   flow has no rating step, even if `myMeetingHappened === undefined`).
 * - Mentee role opens `'rating'` only when uncancelled and `nextStep === 'RATE'`,
 *   otherwise `'attendance'`.
 */
export function resolveFeedbackInitialStep(opts: {
  reservation: Pick<Reservation, 'cancelledBy' | 'feedback'> | null | undefined;
  role: ReservationPolicyRole;
  mode?: 'create' | 'edit';
}): FeedbackInitialStep {
  if (opts.mode === 'edit') {
    return 'rating';
  }
  if (opts.role === 'mentor') {
    return 'attendance';
  }
  if (
    opts.reservation &&
    !isReservationCancelled(opts.reservation) &&
    opts.reservation.feedback?.nextStep === 'RATE'
  ) {
    return 'rating';
  }
  return 'attendance';
}

/**
 * Resolves the dialog step (`'attendance' | 'rating' | 'not-happened'`) when an
 * optional `requestedStep` prop is passed to `MeetingFeedbackDialog` (e.g.
 * Storybook step previews), while guaranteeing Mentors can never land on the
 * Mentee-only `'rating'` step.
 */
export function resolveFeedbackDialogStep(opts: {
  reservation: Pick<Reservation, 'cancelledBy' | 'feedback'> | null | undefined;
  role: ReservationPolicyRole;
  mode?: 'create' | 'edit';
  requestedStep?: FeedbackDialogStep;
}): FeedbackDialogStep {
  if (opts.mode === 'edit') {
    return 'rating';
  }
  if (opts.requestedStep === 'not-happened') {
    return 'not-happened';
  }
  if (opts.role === 'mentor') {
    return 'attendance';
  }
  if (opts.requestedStep === 'rating' || opts.requestedStep === 'attendance') {
    return opts.requestedStep;
  }
  return resolveFeedbackInitialStep({
    reservation: opts.reservation,
    role: opts.role,
    mode: opts.mode,
  });
}
