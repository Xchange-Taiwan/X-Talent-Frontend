import dayjs from 'dayjs';

import {
  formatExperience,
  mapReservationFeedbackDto,
  normalizeFeedbackCounterpartDto,
  resolveFeedbackPartyIds,
} from '@/lib/reservation/mapReservationFeedbackDto';
import {
  resolveCancelledBy,
  resolveCancelledByLabel,
} from '@/lib/reservation/reservationLifecyclePolicy';
import type { components } from '@/types/api';
import type { Reservation, ReservationMessage } from '@/types/reservation';
import type {
  FeedbackViewerRole,
  RawPendingFeedbackItem,
  RawPendingFeedbackResponse,
  RawReservationFeedback,
} from '@/types/reservationFeedback';

export { formatExperience };

/* ============================================================================
 * 1. Domain Types & Interfaces
 * ========================================================================== */

/**
 * Which side the current viewer is on for a reservation. Lowercase to match
 * this codebase's `sourceRole` / `myRole` convention (as opposed to uppercase
 * `'MENTEE' | 'MENTOR'` used on the wire and on `Reservation.viewerRole`).
 */
export type ReservationViewerRole = 'mentor' | 'mentee';

export interface CounterpartyResolvable {
  senderUserId: number | string;
  participantUserId: number | string;
}

export type ReservationInfoVOWithCancelledBy =
  components['schemas']['ReservationInfoVO'] & {
    cancelled_by?: 'MENTEE' | 'MENTOR' | 'SYSTEM' | null;
  };

export type ReservationInfoVOWithVersion =
  components['schemas']['ReservationInfoVO'] & {
    version?: number;
    cancelled_by?: 'MENTEE' | 'MENTOR' | 'SYSTEM' | null;
    feedback?: RawReservationFeedback | null;
  };

export type PendingFeedbackCandidate =
  ReservationInfoVOWithVersion | RawPendingFeedbackItem;

export type RawPendingFeedbackInput =
  | RawPendingFeedbackResponse
  | PendingFeedbackCandidate[]
  | {
      reservations?: PendingFeedbackCandidate[] | null;
      items?: PendingFeedbackCandidate[] | null;
    }
  | null
  | undefined;

export interface ReservationViewerModel {
  viewerRole: ReservationViewerRole | undefined;
  profileHref: string | undefined;
  cancelledByLabel: string | undefined;
}

export interface ResolveReservationViewerOptions {
  reservation: Reservation | null;
  myUserId: string | number | undefined | null;
}

export interface ResolvedReservationMessages {
  messages: ReservationMessage[];
  menteeMessage?: ReservationMessage;
  mentorMessage?: ReservationMessage;
  cancelReasonMessage?: ReservationMessage;
}

export interface BuildReservationFixtureOptions extends Partial<Reservation> {
  /**
   * Optional signed-in viewer user ID used to pre-project `counterpartyUserId`,
   * `profileHref` (with self-profile guard), `normalizedViewerRole`, and
   * `targetMentorId` when building test or Storybook fixtures.
   */
  myUserId?: string | number | null;
}

/* ============================================================================
 * 2. Date / Time Formatting & Pending Feedback Sorting
 * ========================================================================== */

export function formatDateTime(dtstart: number, dtend: number) {
  const start = dayjs.unix(dtstart);
  const end = dayjs.unix(dtend);
  return {
    date: start.format('ddd, MMM DD, YYYY'),
    time: `${start.format('h:mm a')} – ${end.format('h:mm a')}`,
  };
}

export function formatPendingFeedbackDateTime(dtstart: number, dtend: number) {
  const start = dayjs.unix(dtstart);
  const safeDtend =
    typeof dtend === 'number' && Number.isFinite(dtend) && dtend > 0
      ? dtend
      : dtstart;
  const end = dayjs.unix(safeDtend);
  return {
    date: start.format('YYYY/MM/DD'),
    time: `${start.format('HH:mm')}–${end.format('HH:mm')}`,
  };
}

/**
 * Sorts pending feedback meetings chronologically by end time (`dtend`) from
 * oldest to newest (`由舊到新`), breaking ties by `dtstart` and `id` (#760 §6).
 */
export function sortPendingFeedbackOldestFirst(
  items: readonly Reservation[]
): Reservation[] {
  return [...items].sort((a, b) => {
    const aEnd = typeof a.dtend === 'number' ? a.dtend : 0;
    const bEnd = typeof b.dtend === 'number' ? b.dtend : 0;
    if (aEnd !== bEnd) {
      return aEnd - bEnd;
    }
    const aStart = typeof a.dtstart === 'number' ? a.dtstart : 0;
    const bStart = typeof b.dtstart === 'number' ? b.dtstart : 0;
    if (aStart !== bStart) {
      return aStart - bStart;
    }
    return String(a.id).localeCompare(String(b.id), undefined, {
      numeric: true,
    });
  });
}

/* ============================================================================
 * 3. Counterparty & Viewer Projection
 * ========================================================================== */

function toViewerRole(
  role: 'MENTEE' | 'MENTOR' | undefined
): ReservationViewerRole | undefined {
  if (role === 'MENTOR') return 'mentor';
  if (role === 'MENTEE') return 'mentee';
  return undefined;
}

function toNonEmptyUserIdString(
  rawId: string | number | undefined | null
): string | undefined {
  if (rawId === undefined || rawId === null || rawId === 0 || rawId === '') {
    return undefined;
  }
  const str = String(rawId).trim();
  return str.length > 0 && str !== '0' ? str : undefined;
}

/**
 * Resolves the counterparty's user ID from a mapped Reservation based on who is currently logged in.
 */
export function resolveCounterpartyId(
  reservation: CounterpartyResolvable,
  myUserId: string | number
): string | number {
  if (!reservation) {
    return '';
  }
  const senderId = reservation.senderUserId;
  if (
    senderId != null &&
    myUserId != null &&
    String(myUserId) === String(senderId)
  ) {
    return reservation.participantUserId;
  }
  return reservation.senderUserId;
}

/**
 * Resolves the positive numeric mentor user ID whose public profile / feedback cache
 * may be affected by a reservation feedback mutation.
 */
export function resolveTargetMentorId(
  reservation: CounterpartyResolvable,
  myUserId: string | number,
  myRole: FeedbackViewerRole
): number | undefined {
  const rawTargetId =
    myRole === 'mentor'
      ? Number(myUserId)
      : Number(resolveCounterpartyId(reservation, myUserId));
  return Number.isFinite(rawTargetId) && rawTargetId > 0
    ? rawTargetId
    : undefined;
}

/**
 * Resolves the viewer's feedback role ('mentor' | 'mentee') for a reservation,
 * preferring the explicit per-reservation `viewerRole` and falling back to
 * session mentor identity when simplified backend items omit `viewer_role`.
 */
export function resolveFeedbackViewerRole(
  viewerRole: 'MENTEE' | 'MENTOR' | null | undefined,
  isMentorFallback = false
): FeedbackViewerRole {
  if (viewerRole === 'MENTOR') {
    return 'mentor';
  }
  if (viewerRole === 'MENTEE') {
    return 'mentee';
  }
  return isMentorFallback ? 'mentor' : 'mentee';
}

/**
 * Ensures a reservation carries an explicit `viewerRole` ('MENTOR' | 'MENTEE'),
 * preserving per-item roles in mixed queues while filling missing roles from
 * `isMentorFallback`.
 */
export function normalizeReservationViewerRole<
  T extends { viewerRole?: 'MENTEE' | 'MENTOR' },
>(reservation: T, isMentorFallback: boolean): T {
  if (
    reservation.viewerRole === 'MENTOR' ||
    reservation.viewerRole === 'MENTEE'
  ) {
    return reservation;
  }
  return {
    ...reservation,
    viewerRole: isMentorFallback ? 'MENTOR' : 'MENTEE',
  };
}

/**
 * Resolves the counterparty details (profile fields, cancellation role with
 * participant/other-side precedence, and viewer role) from a raw ReservationInfoVO.
 */
export function resolveCounterpartyProfile(
  reservation: ReservationInfoVOWithCancelledBy,
  myUserId?: string | number | null
): {
  name: string;
  avatar?: string;
  roleLine: string;
  cancelledBy?: 'MENTEE' | 'MENTOR' | 'SYSTEM';
  viewerRole?: 'MENTEE' | 'MENTOR';
} {
  if (!reservation) {
    return {
      name: '—',
      avatar: undefined,
      roleLine: '',
      cancelledBy: undefined,
      viewerRole: undefined,
    };
  }

  const counterparty =
    myUserId == null
      ? (reservation.participant ?? reservation.sender)
      : reservation.sender?.user_id != null &&
          String(myUserId) === String(reservation.sender.user_id)
        ? (reservation.participant ?? reservation.sender)
        : (reservation.sender ?? reservation.participant);

  const name = counterparty?.name || '—';
  const avatar = counterparty?.avatar ?? undefined;

  const roleLine = [
    counterparty?.job_title?.trim() || '',
    formatExperience(counterparty?.years_of_experience),
  ]
    .filter(Boolean)
    .join(', ');

  const toRole = (r?: string | null): 'MENTEE' | 'MENTOR' | undefined =>
    r === 'MENTEE' || r === 'MENTOR' ? r : undefined;

  const currentUserSide =
    counterparty === reservation.participant
      ? reservation.sender
      : reservation.participant;

  const cancelledBy = resolveCancelledBy({
    explicitCancelledBy: reservation.cancelled_by,
    counterpartyRole: counterparty?.role,
    counterpartyStatus: counterparty?.status,
    currentUserRole: currentUserSide?.role,
    currentUserStatus: currentUserSide?.status,
  });

  const viewerRole =
    myUserId == null ? undefined : toRole(currentUserSide?.role);

  return {
    name,
    avatar,
    roleLine,
    cancelledBy,
    viewerRole,
  };
}

function resolveProfileHref(
  reservation: CounterpartyResolvable,
  myUserId: string | number | undefined | null
): string | undefined {
  if (myUserId == null || myUserId === '') return undefined;

  const otherId = resolveCounterpartyId(reservation, myUserId);
  // Self-guard: skip when counterparty couldn't be resolved (falsy id, e.g. 0)
  // or would resolve to the viewer themself.
  if (!otherId || String(otherId) === String(myUserId)) return undefined;

  return `/profile/${otherId}`;
}

function projectViewerFields(opts: {
  senderUserId: number | string;
  participantUserId: number | string;
  viewerRole?: 'MENTEE' | 'MENTOR';
  cancelledBy?: 'MENTEE' | 'MENTOR' | 'SYSTEM';
  myUserId?: string | number | null;
  explicitMentorUserId?: string;
}): Pick<
  Reservation,
  | 'counterpartyUserId'
  | 'profileHref'
  | 'cancelledByLabel'
  | 'normalizedViewerRole'
  | 'targetMentorId'
> {
  const {
    senderUserId,
    participantUserId,
    viewerRole,
    cancelledBy,
    myUserId,
    explicitMentorUserId,
  } = opts;
  const normalizedViewerRole = toViewerRole(viewerRole);
  const cancelledByLabel = resolveCancelledByLabel(cancelledBy);

  const hasSignedInViewer = myUserId != null && myUserId !== '';
  const counterpartyUserId = hasSignedInViewer
    ? toNonEmptyUserIdString(
        resolveCounterpartyId({ senderUserId, participantUserId }, myUserId)
      )
    : undefined;

  const profileHref =
    hasSignedInViewer &&
    counterpartyUserId &&
    counterpartyUserId !== String(myUserId)
      ? `/profile/${counterpartyUserId}`
      : undefined;

  const targetMentorId =
    normalizedViewerRole === 'mentor' && hasSignedInViewer
      ? toNonEmptyUserIdString(myUserId)
      : normalizedViewerRole === 'mentee' && counterpartyUserId
        ? counterpartyUserId
        : explicitMentorUserId;

  return {
    ...(counterpartyUserId ? { counterpartyUserId } : {}),
    ...(profileHref ? { profileHref } : {}),
    ...(cancelledByLabel ? { cancelledByLabel } : {}),
    ...(normalizedViewerRole ? { normalizedViewerRole } : {}),
    ...(targetMentorId ? { targetMentorId } : {}),
  };
}

/**
 * Given a reservation and the current viewer, answers what that viewer sees:
 * which side they're on, the counterparty's profile link (with self-guard),
 * and the localized cancellation status label.
 */
export function resolveReservationViewer({
  reservation,
  myUserId,
}: ResolveReservationViewerOptions): ReservationViewerModel {
  const viewerRole = reservation
    ? (toViewerRole(reservation.viewerRole) ?? reservation.normalizedViewerRole)
    : undefined;
  const profileHref = reservation
    ? resolveProfileHref(reservation, myUserId)
    : undefined;
  const cancelledByLabel = resolveCancelledByLabel(reservation?.cancelledBy);

  return {
    viewerRole,
    profileHref,
    cancelledByLabel,
  };
}

/**
 * Checks whether `reservation` already carries pre-projected viewer and
 * cancellation fields aligned with `myUserId`, allowing UI components to read
 * `profileHref` / `cancelledByLabel` directly off `reservation` without
 * re-running `resolveReservationViewer`.
 */
export function isReservationViewerProjected(
  reservation: Reservation,
  myUserId: string | number | undefined | null
): boolean {
  if (
    Boolean(reservation.cancelledBy) !==
      Boolean(reservation.cancelledByLabel) ||
    reservation.cancelledByLabel !==
      resolveCancelledByLabel(reservation.cancelledBy)
  ) {
    return false;
  }
  if (
    reservation.viewerRole !== undefined &&
    reservation.normalizedViewerRole !== toViewerRole(reservation.viewerRole)
  ) {
    return false;
  }
  if (myUserId == null || myUserId === '') {
    return reservation.profileHref === undefined;
  }

  const expectedProfileHref = resolveProfileHref(reservation, myUserId);
  if (expectedProfileHref !== undefined) {
    return reservation.profileHref === expectedProfileHref;
  }

  return (
    reservation.profileHref === undefined &&
    (reservation.normalizedViewerRole !== undefined ||
      reservation.counterpartyUserId === String(myUserId))
  );
}

/* ============================================================================
 * 4. Conversation Thread & Preview Message Classification
 * ========================================================================== */

function findCancelReasonIndex(
  messages: readonly ReservationMessage[],
  cancelledBy?: Reservation['cancelledBy']
): number {
  if (messages.length === 0) {
    return -1;
  }

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].isCancelReason) {
      return i;
    }
  }

  if (cancelledBy === 'MENTEE') {
    let menteeCount = 0;
    let lastMenteeIdx = -1;
    for (let i = 0; i < messages.length; i += 1) {
      if (messages[i].role === 'MENTEE') {
        menteeCount += 1;
        lastMenteeIdx = i;
      }
    }
    return menteeCount >= 2 ? lastMenteeIdx : -1;
  }

  if (cancelledBy === 'MENTOR') {
    let mentorCount = 0;
    let lastMentorIdx = -1;
    for (let i = 0; i < messages.length; i += 1) {
      if (messages[i].role === 'MENTOR') {
        mentorCount += 1;
        lastMentorIdx = i;
      }
    }
    if (mentorCount >= 2) {
      return lastMentorIdx;
    }
    if (mentorCount === 1 && lastMentorIdx === messages.length - 1) {
      return lastMentorIdx;
    }
  }

  return -1;
}

function pickLatestNonCancelMessages(messages: readonly ReservationMessage[]): {
  menteeMessage?: ReservationMessage;
  mentorMessage?: ReservationMessage;
  cancelReasonMessage?: ReservationMessage;
} {
  let menteeMessage: ReservationMessage | undefined;
  let mentorMessage: ReservationMessage | undefined;
  let cancelReasonMessage: ReservationMessage | undefined;

  for (const item of messages) {
    if (item.isCancelReason) {
      cancelReasonMessage = item;
      continue;
    }
    if (item.role === 'MENTEE') {
      menteeMessage = item;
    } else if (item.role === 'MENTOR') {
      mentorMessage = item;
    }
  }

  return {
    menteeMessage,
    mentorMessage,
    cancelReasonMessage,
  };
}

/**
 * Splits a chronological list of reservation messages into:
 * - `menteeMessage`: the mentee's booking question / latest non-cancel message
 * - `mentorMessage`: the mentor's reply / latest non-cancel message
 * - `cancelReasonMessage`: the cancellation/rejection reason when cancelled
 * - `messages`: full thread with `isCancelReason: true` set on the cancel reason entry
 */
export function classifyReservationMessages(
  rawMessages: ReservationMessage[],
  cancelledBy?: 'MENTEE' | 'MENTOR' | 'SYSTEM'
): ResolvedReservationMessages {
  const messages = rawMessages.map((msg) => ({ ...msg }));
  const cancelIdx = findCancelReasonIndex(messages, cancelledBy);

  if (cancelIdx >= 0 && cancelIdx < messages.length) {
    messages[cancelIdx] = {
      ...messages[cancelIdx],
      isCancelReason: true,
    };
  }

  const { menteeMessage, mentorMessage, cancelReasonMessage } =
    pickLatestNonCancelMessages(messages);

  return {
    messages,
    menteeMessage,
    mentorMessage,
    cancelReasonMessage,
  };
}

/**
 * Resolves message preview fields and conversation thread entries from a
 * `Reservation`, handling both `mapToReservation`-mapped objects and raw test /
 * Storybook fixtures.
 */
export function resolveReservationMessages(
  reservation: Pick<
    Reservation,
    | 'messages'
    | 'menteeMessage'
    | 'mentorMessage'
    | 'cancelReasonMessage'
    | 'cancelledBy'
  >
): ResolvedReservationMessages {
  const classified = classifyReservationMessages(
    reservation.messages ?? [],
    reservation.cancelledBy
  );

  const explicitCancelReason = reservation.cancelReasonMessage
    ? { ...reservation.cancelReasonMessage, isCancelReason: true }
    : undefined;

  const cancelReasonMessage =
    explicitCancelReason ?? classified.cancelReasonMessage;

  let messages = classified.messages;
  let didSplitExplicitFromThread = false;
  if (
    explicitCancelReason &&
    !messages.some((m) => m.isCancelReason) &&
    messages.length > 0
  ) {
    const matchIdx = messages.findLastIndex(
      (m) => m.content === explicitCancelReason.content
    );
    if (matchIdx >= 0) {
      messages = messages.map((m, idx) =>
        idx === matchIdx ? { ...m, isCancelReason: true } : m
      );
      didSplitExplicitFromThread = true;
    }
  }

  const effectiveClassified = didSplitExplicitFromThread
    ? classifyReservationMessages(messages, reservation.cancelledBy)
    : classified;

  const didSplitFromThread =
    effectiveClassified.cancelReasonMessage !== undefined;

  const menteeMessage = didSplitFromThread
    ? effectiveClassified.menteeMessage
    : reservation.menteeMessage;

  const mentorMessage = didSplitFromThread
    ? effectiveClassified.mentorMessage
    : reservation.mentorMessage;

  return {
    messages,
    menteeMessage,
    mentorMessage,
    cancelReasonMessage,
  };
}

/**
 * Checks whether `reservation`'s message preview and thread entries are already
 * projected so UI components can read `messages`, `menteeMessage`,
 * `mentorMessage`, and `cancelReasonMessage` directly off `reservation` without
 * re-running `resolveReservationMessages`.
 */
export function isReservationMessagesProjected(
  reservation: Pick<
    Reservation,
    | 'messages'
    | 'menteeMessage'
    | 'mentorMessage'
    | 'cancelReasonMessage'
    | 'cancelledBy'
    | 'cancelledByLabel'
  >
): boolean {
  const messages = reservation.messages ?? [];
  if (!reservation.cancelledBy && !reservation.cancelReasonMessage) {
    return findCancelReasonIndex(messages) === -1;
  }

  if (reservation.cancelReasonMessage) {
    if (!reservation.cancelReasonMessage.isCancelReason) {
      return false;
    }
    if (messages.length > 0) {
      const latest = pickLatestNonCancelMessages(messages);
      if (
        !latest.cancelReasonMessage ||
        reservation.menteeMessage?.content !== latest.menteeMessage?.content ||
        reservation.mentorMessage?.content !== latest.mentorMessage?.content
      ) {
        return false;
      }
    }
    if (reservation.cancelledByLabel !== undefined) {
      return true;
    }
    return (
      reservation.menteeMessage?.content !==
        reservation.cancelReasonMessage.content &&
      reservation.mentorMessage?.content !==
        reservation.cancelReasonMessage.content
    );
  }

  return findCancelReasonIndex(messages, reservation.cancelledBy) === -1;
}

/* ============================================================================
 * 5. DTO-to-Domain Projection & Pending Feedback Queue Mapping
 * ========================================================================== */

function classifyMessageRole(
  message: components['schemas']['ReservationMessageVO'],
  userIdToRole: Map<string, string | null | undefined>
): 'MENTEE' | 'MENTOR' | undefined {
  if (message.role === 'MENTEE' || message.role === 'MENTOR')
    return message.role;
  const fallback =
    message.user_id != null
      ? userIdToRole.get(String(message.user_id))
      : undefined;
  if (fallback === 'MENTEE' || fallback === 'MENTOR') return fallback;
  return undefined;
}

function resolveDtoMentorUserId(
  reservation: ReservationInfoVOWithVersion
): string | undefined {
  if (reservation.participant?.role === 'MENTOR') {
    return toNonEmptyUserIdString(reservation.participant.user_id);
  }
  if (reservation.sender?.role === 'MENTOR') {
    return toNonEmptyUserIdString(reservation.sender.user_id);
  }
  return undefined;
}

export function projectReservation(
  reservation: ReservationInfoVOWithVersion,
  myUserId?: string | number | null
): Reservation {
  const { name, avatar, roleLine, cancelledBy, viewerRole } =
    resolveCounterpartyProfile(reservation, myUserId);
  const { date, time } = formatDateTime(reservation.dtstart, reservation.dtend);
  const feedback = mapReservationFeedbackDto(reservation.feedback);

  const userIdToRole = new Map<string, string | null | undefined>([
    [String(reservation.sender?.user_id ?? ''), reservation.sender?.role],
    [
      String(reservation.participant?.user_id ?? ''),
      reservation.participant?.role,
    ],
  ]);

  const rawMessages: ReservationMessage[] = [];
  for (const message of reservation.messages ?? []) {
    if (typeof message.content !== 'string') continue;
    const trimmed = message.content.trim();
    if (trimmed.length === 0) continue;
    const role = classifyMessageRole(message, userIdToRole);
    const item: ReservationMessage = role
      ? { content: trimmed, role }
      : { content: trimmed };
    rawMessages.push(item);
  }

  const { messages, menteeMessage, mentorMessage, cancelReasonMessage } =
    classifyReservationMessages(rawMessages, cancelledBy);

  const senderUserId = reservation.sender?.user_id ?? 0;
  const participantUserId = reservation.participant?.user_id ?? 0;
  const projectedViewerFields = projectViewerFields({
    senderUserId,
    participantUserId,
    viewerRole,
    cancelledBy,
    myUserId,
    explicitMentorUserId: resolveDtoMentorUserId(reservation),
  });

  return {
    id: String(reservation.id ?? ''),
    name,
    roleLine,
    date,
    time,
    avatar,
    messages,
    menteeMessage,
    mentorMessage,
    ...(cancelReasonMessage ? { cancelReasonMessage } : {}),
    scheduleId: reservation.schedule_id,
    dtstart: reservation.dtstart,
    dtend: reservation.dtend,
    senderUserId,
    participantUserId,
    cancelledBy,
    viewerRole,
    ...projectedViewerFields,
    version: reservation.version ?? 0,
    ...(feedback ? { feedback } : {}),
  };
}

/**
 * Alias of `projectReservation` preserved for existing service and test callers.
 */
export const mapToReservation = projectReservation;

function isFullReservationInfoVO(
  item: PendingFeedbackCandidate
): item is ReservationInfoVOWithVersion {
  return 'sender' in item || 'participant' in item;
}

export function extractRawPendingFeedbackList(
  data: RawPendingFeedbackInput
): PendingFeedbackCandidate[] {
  if (!data) {
    return [];
  }
  if (Array.isArray(data)) {
    return data;
  }
  if (typeof data === 'object') {
    if (Array.isArray(data.reservations)) {
      return data.reservations;
    }
    if (Array.isArray(data.items)) {
      return data.items;
    }
  }
  return [];
}

export function mapPendingFeedbackCandidate(
  candidate: PendingFeedbackCandidate,
  userId: string | number,
  fallbackViewerRole?: 'MENTEE' | 'MENTOR'
): Reservation | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  if (isFullReservationInfoVO(candidate)) {
    const mapped = projectReservation(candidate, userId);
    if (!mapped.id || mapped.cancelledBy) {
      return null;
    }
    if (
      candidate.feedback &&
      candidate.feedback.next_step === null &&
      candidate.feedback.meeting_happened !== null
    ) {
      return null;
    }
    const formattedDateTime =
      mapped.dtstart > 0
        ? formatPendingFeedbackDateTime(mapped.dtstart, mapped.dtend)
        : undefined;
    const normalizedAvatar =
      typeof mapped.avatar === 'string' && mapped.avatar.trim().length > 0
        ? mapped.avatar.trim()
        : undefined;
    const effectiveViewerRole = mapped.viewerRole ?? fallbackViewerRole;
    const projectedViewerFields = projectViewerFields({
      senderUserId: mapped.senderUserId,
      participantUserId: mapped.participantUserId,
      viewerRole: effectiveViewerRole,
      cancelledBy: mapped.cancelledBy,
      myUserId: userId,
      explicitMentorUserId: mapped.targetMentorId,
    });
    return {
      ...mapped,
      avatar: normalizedAvatar,
      ...(formattedDateTime ?? {}),
      viewerRole: effectiveViewerRole,
      ...projectedViewerFields,
      feedback: mapped.feedback ?? {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
    };
  }

  if (candidate.cancelled_by) {
    return null;
  }
  if (
    candidate.feedback &&
    candidate.feedback.next_step === null &&
    candidate.feedback.meeting_happened !== null
  ) {
    return null;
  }

  const rawId = candidate.id ?? candidate.reservation_id;
  if (rawId === undefined || rawId === null || String(rawId).trim() === '') {
    return null;
  }

  const dtstart =
    typeof candidate.dtstart === 'number' && Number.isFinite(candidate.dtstart)
      ? candidate.dtstart
      : 0;
  const dtend =
    typeof candidate.dtend === 'number' && Number.isFinite(candidate.dtend)
      ? candidate.dtend
      : dtstart;
  const { date, time } =
    dtstart > 0
      ? formatPendingFeedbackDateTime(dtstart, dtend)
      : formatDateTime(dtstart, dtend);

  const rawRole = candidate.viewer_role ?? candidate.role ?? fallbackViewerRole;
  const viewerRole: 'MENTEE' | 'MENTOR' | undefined =
    rawRole === 'MENTOR' || rawRole === 'MENTEE' ? rawRole : undefined;

  const { name, avatar, roleLine, counterpartyUserId } =
    normalizeFeedbackCounterpartDto(candidate);
  const { senderUserId, participantUserId } = resolveFeedbackPartyIds(
    userId,
    counterpartyUserId,
    viewerRole
  );

  const mappedFeedback = mapReservationFeedbackDto(candidate.feedback);
  const projectedViewerFields = projectViewerFields({
    senderUserId,
    participantUserId,
    viewerRole,
    myUserId: userId,
  });

  return {
    id: String(rawId),
    name,
    roleLine,
    date,
    time,
    avatar,
    messages: [],
    scheduleId: candidate.schedule_id ?? 0,
    dtstart,
    dtend,
    senderUserId,
    participantUserId,
    viewerRole,
    ...projectedViewerFields,
    version: candidate.version ?? 0,
    feedback: mappedFeedback ?? {
      meetingHappened: null,
      rating: null,
      nextStep: 'ANSWER',
    },
  };
}

/**
 * Extracts, projects, filters ineligible/duplicate items, and sorts pending
 * feedback meetings chronologically from oldest to newest (`由舊到新`).
 */
export function projectPendingFeedbackList(
  rawResponse: RawPendingFeedbackInput,
  userId: string | number,
  fallbackRole?: 'MENTEE' | 'MENTOR'
): Reservation[] {
  if (userId === undefined || userId === null || String(userId).trim() === '') {
    return [];
  }

  const rawList = extractRawPendingFeedbackList(rawResponse);
  const seenIds = new Set<string>();
  const mappedItems: Reservation[] = [];

  for (const rawItem of rawList) {
    const mapped = mapPendingFeedbackCandidate(rawItem, userId, fallbackRole);
    if (!mapped || seenIds.has(mapped.id)) {
      continue;
    }
    seenIds.add(mapped.id);
    mappedItems.push(mapped);
  }

  return sortPendingFeedbackOldestFirst(mappedItems);
}

/* ============================================================================
 * 6. Test & Storybook Fixture Builder
 * ========================================================================== */

/**
 * Builds a complete, pre-projected `Reservation` fixture for unit tests and
 * Storybook stories, classifying messages and resolving optional viewer /
 * counterparty / cancellation fields in one pure call.
 */
export function buildReservationFixture(
  options: BuildReservationFixtureOptions = {}
): Reservation {
  const {
    myUserId,
    id = 'res-fixture-1',
    name = '王小明 (Alvin Wang)',
    avatar,
    roleLine = 'Senior Frontend Engineer, 3~5 年',
    dtstart = 1704099600,
    dtend = dtstart + 3600,
    scheduleId = 101,
    version = 0,
    senderUserId = 'user-mentee-111',
    participantUserId = 'user-mentor-222',
    cancelledBy,
    viewerRole,
    feedback,
  } = options;

  const formattedDateTime = formatDateTime(dtstart, dtend);
  const date = options.date ?? formattedDateTime.date;
  const time = options.time ?? formattedDateTime.time;

  const rawMessages = options.messages ?? [];
  const classified = classifyReservationMessages(rawMessages, cancelledBy);
  const hasExplicitMenteeMessage = 'menteeMessage' in options;
  const hasExplicitMentorMessage = 'mentorMessage' in options;

  const resolvedMessages = resolveReservationMessages({
    messages: rawMessages,
    menteeMessage: hasExplicitMenteeMessage
      ? options.menteeMessage
      : classified.menteeMessage,
    mentorMessage: hasExplicitMentorMessage
      ? options.mentorMessage
      : classified.mentorMessage,
    cancelReasonMessage: options.cancelReasonMessage,
    cancelledBy,
  });

  const projectedViewerFields = projectViewerFields({
    senderUserId,
    participantUserId,
    viewerRole,
    cancelledBy,
    myUserId,
  });

  const counterpartyUserId =
    options.counterpartyUserId ?? projectedViewerFields.counterpartyUserId;
  const profileHref = options.profileHref ?? projectedViewerFields.profileHref;
  const cancelledByLabel =
    options.cancelledByLabel ?? projectedViewerFields.cancelledByLabel;
  const normalizedViewerRole =
    options.normalizedViewerRole ?? projectedViewerFields.normalizedViewerRole;
  const targetMentorId =
    options.targetMentorId ?? projectedViewerFields.targetMentorId;

  return {
    id,
    name,
    avatar,
    roleLine,
    date,
    time,
    messages: resolvedMessages.messages,
    menteeMessage: resolvedMessages.menteeMessage,
    mentorMessage: resolvedMessages.mentorMessage,
    ...(resolvedMessages.cancelReasonMessage
      ? { cancelReasonMessage: resolvedMessages.cancelReasonMessage }
      : {}),
    scheduleId,
    dtstart,
    dtend,
    version,
    senderUserId,
    participantUserId,
    cancelledBy,
    viewerRole,
    ...(counterpartyUserId ? { counterpartyUserId } : {}),
    ...(profileHref ? { profileHref } : {}),
    ...(cancelledByLabel ? { cancelledByLabel } : {}),
    ...(normalizedViewerRole ? { normalizedViewerRole } : {}),
    ...(targetMentorId ? { targetMentorId } : {}),
    ...(feedback ? { feedback } : {}),
  };
}
