import { TotalWorkSpanEnum } from '@/constant/seniority';
import type {
  RawPendingFeedbackCounterpart,
  RawReservationFeedback,
  RawReservationRating,
  ReservationFeedback,
  ReservationRating,
} from '@/types/reservationFeedback';

export function formatExperience(yearsOfExperience?: string | null): string {
  return (
    TotalWorkSpanEnum[yearsOfExperience as keyof typeof TotalWorkSpanEnum] ?? ''
  );
}

export interface FeedbackCounterpartDtoInput {
  counterpart?: RawPendingFeedbackCounterpart | null;
  counterparty?: RawPendingFeedbackCounterpart | null;
  counterparty_name?: string | null;
  counterparty_avatar?: string | null;
}

export interface NormalizedFeedbackCounterpart {
  name: string;
  avatar: string | undefined;
  roleLine: string;
  counterpartyUserId: number;
}

export interface FeedbackCandidateDtoInput extends FeedbackCounterpartDtoInput {
  id?: number | string | null;
  reservation_id?: number | string | null;
  schedule_id?: number | null;
  dtstart?: number | null;
  dtend?: number | null;
  version?: number | null;
  role?: string | null;
  viewer_role?: string | null;
  cancelled_by?: 'MENTEE' | 'MENTOR' | 'SYSTEM' | string | null;
  feedback?: RawReservationFeedback | null;
}

export interface NormalizeFeedbackCandidateOptions {
  fallbackViewerRole?: 'MENTEE' | 'MENTOR';
  preferReservationId?: boolean;
  preferRoleField?: boolean;
}

export interface NormalizedFeedbackCandidateDto {
  id: string;
  name: string;
  avatar: string | undefined;
  roleLine: string;
  counterpartyUserId: number;
  senderUserId: number;
  participantUserId: number;
  dtstart: number;
  dtend: number;
  scheduleId: number;
  version: number;
  viewerRole: 'MENTEE' | 'MENTOR' | undefined;
  cancelledBy: 'MENTEE' | 'MENTOR' | 'SYSTEM' | undefined;
  feedback: ReservationFeedback | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Resolves ONLY the viewer's own attendance flag (`myMeetingHappened`) from a
 * raw feedback wire DTO (#735 / #760 §3.1), prioritizing `my_meeting_happened`,
 * then legacy `mentor_meeting_happened`, and falling back to `meeting_happened`
 * (or `null` when unanswered/omitted).
 */
export function resolveRawMyMeetingHappened(
  raw: RawReservationFeedback
): boolean | null {
  if (
    raw.my_meeting_happened === null ||
    typeof raw.my_meeting_happened === 'boolean'
  ) {
    return raw.my_meeting_happened;
  }
  if (
    raw.mentor_meeting_happened === null ||
    typeof raw.mentor_meeting_happened === 'boolean'
  ) {
    return raw.mentor_meeting_happened;
  }
  return typeof raw.meeting_happened === 'boolean'
    ? raw.meeting_happened
    : null;
}

export function mapReservationRatingDto(
  rawRating: RawReservationRating | null | undefined
): ReservationRating | null {
  if (
    !rawRating ||
    typeof rawRating !== 'object' ||
    typeof rawRating.rating !== 'number' ||
    !Number.isFinite(rawRating.rating)
  ) {
    return null;
  }

  return {
    rating: rawRating.rating,
    content: typeof rawRating.content === 'string' ? rawRating.content : '',
    createdAt:
      typeof rawRating.created_at === 'number' ? rawRating.created_at : 0,
    updatedAt:
      typeof rawRating.updated_at === 'number' ? rawRating.updated_at : 0,
    authorName:
      typeof rawRating.author_name === 'string' ? rawRating.author_name : null,
    isPublic: rawRating.is_public !== false,
  };
}

/**
 * Canonical wire-to-domain mapper for `RawReservationFeedback`, shared across
 * reservation list queries, pending-feedback queue items, and single-reservation
 * feedback deep-link lookups.
 */
export function mapReservationFeedbackDto(
  raw: RawReservationFeedback | null | undefined
): ReservationFeedback | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const meetingHappened =
    typeof raw.meeting_happened === 'boolean' ? raw.meeting_happened : null;
  const myMeetingHappened = resolveRawMyMeetingHappened(raw);
  const rating = mapReservationRatingDto(raw.rating);
  const nextStep =
    raw.next_step === 'ANSWER' || raw.next_step === 'RATE'
      ? raw.next_step
      : null;

  return {
    meetingHappened,
    myMeetingHappened,
    rating,
    nextStep,
  };
}

export function normalizeFeedbackCounterpartDto(
  raw: FeedbackCounterpartDtoInput
): NormalizedFeedbackCounterpart {
  const cp = raw.counterpart ?? raw.counterparty;
  const name = cp?.name?.trim() || raw.counterparty_name?.trim() || '—';
  const rawAvatar = cp?.avatar ?? raw.counterparty_avatar ?? undefined;
  const avatar =
    typeof rawAvatar === 'string' && rawAvatar.trim().length > 0
      ? rawAvatar.trim()
      : undefined;
  const companyOrExp =
    cp?.company?.trim() || formatExperience(cp?.years_of_experience);
  const roleLine = [cp?.job_title?.trim() || '', companyOrExp]
    .filter(Boolean)
    .join(', ');
  const counterpartyUserId = typeof cp?.user_id === 'number' ? cp.user_id : 0;

  return {
    name,
    avatar,
    roleLine,
    counterpartyUserId,
  };
}

export function resolveFeedbackPartyIds(
  userId: string | number,
  counterpartyUserId: number,
  viewerRole: 'MENTEE' | 'MENTOR' | undefined
): { senderUserId: number; participantUserId: number } {
  const myNumericId = Number(userId);
  const resolvedMyId = Number.isFinite(myNumericId) ? myNumericId : 0;

  return {
    senderUserId: viewerRole === 'MENTOR' ? counterpartyUserId : resolvedMyId,
    participantUserId:
      viewerRole === 'MENTOR' ? resolvedMyId : counterpartyUserId,
  };
}

export function normalizeCancelledByDto(
  cancelledBy: unknown
): 'MENTEE' | 'MENTOR' | 'SYSTEM' | undefined {
  return cancelledBy === 'MENTEE' ||
    cancelledBy === 'MENTOR' ||
    cancelledBy === 'SYSTEM'
    ? cancelledBy
    : undefined;
}

/**
 * Canonical wire-to-domain candidate normalizer shared by pending-feedback list
 * items (`RawPendingFeedbackItem`) and single-reservation feedback lookups
 * (`RawSingleReservationFeedbackVO`), eliminating duplicate counterpart, party-ID,
 * role, and timestamp assembly (#944).
 */
export function normalizeFeedbackCandidateDto(
  raw: FeedbackCandidateDtoInput | null | undefined,
  userId: string | number,
  options: NormalizeFeedbackCandidateOptions = {}
): NormalizedFeedbackCandidateDto | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const rawId = options.preferReservationId
    ? (raw.reservation_id ?? raw.id)
    : (raw.id ?? raw.reservation_id);
  if (rawId === undefined || rawId === null) {
    return null;
  }
  const id = String(rawId).trim();
  if (!id) {
    return null;
  }

  const rawRole = options.preferRoleField
    ? (raw.role ?? raw.viewer_role)
    : (raw.viewer_role ?? raw.role);
  const roleToken =
    typeof rawRole === 'string' ? rawRole.trim().toUpperCase() : '';
  const viewerRole: 'MENTEE' | 'MENTOR' | undefined =
    roleToken === 'MENTOR'
      ? 'MENTOR'
      : roleToken === 'MENTEE'
        ? 'MENTEE'
        : options.fallbackViewerRole;

  const dtstart =
    typeof raw.dtstart === 'number' && Number.isFinite(raw.dtstart)
      ? raw.dtstart
      : 0;
  const dtend =
    typeof raw.dtend === 'number' && Number.isFinite(raw.dtend)
      ? raw.dtend
      : dtstart;

  const { name, avatar, roleLine, counterpartyUserId } =
    normalizeFeedbackCounterpartDto(raw);
  const { senderUserId, participantUserId } = resolveFeedbackPartyIds(
    userId,
    counterpartyUserId,
    viewerRole
  );
  const cancelledBy = normalizeCancelledByDto(raw.cancelled_by);
  const feedback = mapReservationFeedbackDto(raw.feedback);
  const scheduleId =
    typeof raw.schedule_id === 'number' && Number.isFinite(raw.schedule_id)
      ? raw.schedule_id
      : 0;
  const version =
    typeof raw.version === 'number' && Number.isFinite(raw.version)
      ? raw.version
      : 0;

  return {
    id,
    name,
    avatar,
    roleLine,
    counterpartyUserId,
    senderUserId,
    participantUserId,
    dtstart,
    dtend,
    scheduleId,
    version,
    viewerRole,
    cancelledBy,
    feedback,
  };
}

export function extractBackendIsPublic(
  responseData: unknown
): boolean | undefined {
  if (!isRecord(responseData)) {
    return undefined;
  }
  if (typeof responseData.is_public === 'boolean') {
    return responseData.is_public;
  }
  if (
    isRecord(responseData.rating) &&
    typeof responseData.rating.is_public === 'boolean'
  ) {
    return responseData.rating.is_public;
  }
  if (isRecord(responseData.feedback)) {
    return extractBackendIsPublic(responseData.feedback);
  }
  return undefined;
}

export function extractBackendMeetingHappened(
  responseData: unknown
): boolean | undefined {
  if (!isRecord(responseData)) {
    return undefined;
  }
  if (typeof responseData.meeting_happened === 'boolean') {
    return responseData.meeting_happened;
  }
  if (isRecord(responseData.feedback)) {
    return extractBackendMeetingHappened(responseData.feedback);
  }
  return undefined;
}

export function extractBackendMyMeetingHappened(
  responseData: unknown
): boolean | null | undefined {
  if (!isRecord(responseData)) {
    return undefined;
  }
  if (
    responseData.my_meeting_happened === null ||
    typeof responseData.my_meeting_happened === 'boolean'
  ) {
    return responseData.my_meeting_happened;
  }
  if (
    responseData.mentor_meeting_happened === null ||
    typeof responseData.mentor_meeting_happened === 'boolean'
  ) {
    return responseData.mentor_meeting_happened;
  }
  if (isRecord(responseData.feedback)) {
    return extractBackendMyMeetingHappened(responseData.feedback);
  }
  return undefined;
}
