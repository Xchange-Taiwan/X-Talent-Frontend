import { formatExperience } from '@/lib/reservation/resolveCounterparty';
import type {
  RawPendingFeedbackCounterpart,
  RawReservationFeedback,
  RawReservationRating,
  ReservationFeedback,
  ReservationRating,
} from '@/types/reservationFeedback';

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
