/**
 * Backend #760 `not_happened_reason` enum contract (§4).
 * Both Mentor and Mentee share the same 5 `not_happened_reason` values:
 * `SCHEDULE_CONFLICT`、`COUNTERPART_ABSENT`、`MISSED_NOTIFICATION`、
 * `TECHNICAL_ISSUE`、`OTHER`.
 */
export const NOT_HAPPENED_REASONS = [
  'SCHEDULE_CONFLICT',
  'COUNTERPART_ABSENT',
  'MISSED_NOTIFICATION',
  'TECHNICAL_ISSUE',
  'OTHER',
] as const;

export type NotHappenedReason = (typeof NOT_HAPPENED_REASONS)[number];

export type LegacyNotHappenedReason =
  NotHappenedReason | 'MENTOR_ABSENT' | 'MENTEE_ABSENT';

export type FeedbackViewerRole = 'mentee' | 'mentor';

export const MENTEE_NOT_HAPPENED_REASONS =
  NOT_HAPPENED_REASONS satisfies readonly NotHappenedReason[];

export const MENTOR_NOT_HAPPENED_REASONS =
  NOT_HAPPENED_REASONS satisfies readonly NotHappenedReason[];

export function getNotHappenedReasonsForRole(
  _role: FeedbackViewerRole = 'mentee'
): readonly NotHappenedReason[] {
  return NOT_HAPPENED_REASONS;
}

export function normalizeNotHappenedReason(
  reason: LegacyNotHappenedReason
): NotHappenedReason {
  if (reason === 'MENTOR_ABSENT' || reason === 'MENTEE_ABSENT') {
    return 'COUNTERPART_ABSENT';
  }
  return reason;
}

export function resolveNotHappenedReasonForRole(
  reason: LegacyNotHappenedReason,
  _role: FeedbackViewerRole = 'mentee'
): NotHappenedReason {
  return normalizeNotHappenedReason(reason);
}

export const NOT_HAPPENED_REASON_LABELS: Record<
  LegacyNotHappenedReason,
  string
> = {
  SCHEDULE_CONFLICT: '雙方時間無法配合',
  COUNTERPART_ABSENT: '對方未出席',
  MENTOR_ABSENT: '對方未出席',
  MENTEE_ABSENT: '對方未出席',
  MISSED_NOTIFICATION: '未收到或錯過會議通知',
  TECHNICAL_ISSUE: '技術／連線問題',
  OTHER: '其他',
};

export type FeedbackNextStep = 'ANSWER' | 'RATE' | null;

export interface RawReservationRating {
  rating: number;
  content: string;
  created_at: number;
  updated_at: number;
  author_name: string | null;
  is_public: boolean;
}

export interface RawReservationFeedback {
  meeting_happened: boolean | null;
  my_meeting_happened?: boolean | null;
  mentor_meeting_happened?: boolean | null;
  rating: RawReservationRating | null;
  next_step: FeedbackNextStep;
}

export interface ReservationRating {
  rating: number;
  content: string;
  createdAt: number;
  updatedAt: number;
  authorName: string | null;
  isPublic: boolean;
}

export interface ReservationFeedback {
  meetingHappened: boolean | null;
  myMeetingHappened?: boolean | null;
  rating: ReservationRating | null;
  nextStep: FeedbackNextStep;
}

export interface RawPendingFeedbackCounterpart {
  user_id?: number;
  name?: string | null;
  avatar?: string | null;
  job_title?: string | null;
  company?: string | null;
  years_of_experience?: string | null;
}

export type RawPendingFeedbackCounterparty = RawPendingFeedbackCounterpart;

export interface RawPendingFeedbackItem {
  id?: number | string;
  reservation_id?: number | string;
  schedule_id?: number;
  dtstart: number;
  dtend: number;
  version?: number;
  role?: 'MENTEE' | 'MENTOR' | null;
  viewer_role?: 'MENTEE' | 'MENTOR' | null;
  cancelled_by?: 'MENTEE' | 'MENTOR' | 'SYSTEM' | null;
  counterpart?: RawPendingFeedbackCounterpart | null;
  counterparty?: RawPendingFeedbackCounterparty | null;
  counterparty_name?: string | null;
  counterparty_avatar?: string | null;
  feedback?: RawReservationFeedback | null;
}

export type RawPendingFeedbackResponse =
  | RawPendingFeedbackItem[]
  | {
      reservations?: RawPendingFeedbackItem[] | null;
      items?: RawPendingFeedbackItem[] | null;
    };

export type SubmitReservationFeedbackRequest =
  | {
      meeting_happened: true;
      feedback?: {
        rating: number;
        content: string;
      };
    }
  | {
      meeting_happened: false;
      not_happened_reason: NotHappenedReason;
      note?: string;
    };

export interface UpdateReservationFeedbackRequest {
  rating: number;
  content: string;
}
