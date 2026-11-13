/**
 * Backend #760 `not_happened_reason` enum contract.
 * Per Design Hub (#730 / #740 / #735), Step 2 removes the legacy party-attribution
 * question ("誰沒有進行會談？", i.e. 不問誰未出席) and displays 5 shared options
 * (`雙方時間無法配合`、`對方未出席`、`未收到或錯過會議通知`、`技術／連線問題`、`其他`).
 * Selecting `對方未出席` maps by viewer role (`mentee` -> `MENTOR_ABSENT`,
 * `mentor` -> `MENTEE_ABSENT`) so counterparty absence attribution is never inverted.
 */
export const NOT_HAPPENED_REASONS = [
  'SCHEDULE_CONFLICT',
  'MENTOR_ABSENT',
  'MENTEE_ABSENT',
  'MISSED_NOTIFICATION',
  'TECHNICAL_ISSUE',
  'OTHER',
] as const;

export type NotHappenedReason = (typeof NOT_HAPPENED_REASONS)[number];

export type FeedbackViewerRole = 'mentee' | 'mentor';

export const MENTEE_NOT_HAPPENED_REASONS = [
  'SCHEDULE_CONFLICT',
  'MENTOR_ABSENT',
  'MISSED_NOTIFICATION',
  'TECHNICAL_ISSUE',
  'OTHER',
] as const satisfies readonly NotHappenedReason[];

export const MENTOR_NOT_HAPPENED_REASONS = [
  'SCHEDULE_CONFLICT',
  'MENTEE_ABSENT',
  'MISSED_NOTIFICATION',
  'TECHNICAL_ISSUE',
  'OTHER',
] as const satisfies readonly NotHappenedReason[];

export function getNotHappenedReasonsForRole(
  role: FeedbackViewerRole = 'mentee'
): readonly NotHappenedReason[] {
  return role === 'mentor'
    ? MENTOR_NOT_HAPPENED_REASONS
    : MENTEE_NOT_HAPPENED_REASONS;
}

export function resolveNotHappenedReasonForRole(
  reason: NotHappenedReason,
  role: FeedbackViewerRole = 'mentee'
): NotHappenedReason {
  if (role === 'mentor' && reason === 'MENTOR_ABSENT') {
    return 'MENTEE_ABSENT';
  }
  if (role === 'mentee' && reason === 'MENTEE_ABSENT') {
    return 'MENTOR_ABSENT';
  }
  return reason;
}

export const NOT_HAPPENED_REASON_LABELS: Record<NotHappenedReason, string> = {
  SCHEDULE_CONFLICT: '雙方時間無法配合',
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

export interface RawPendingFeedbackCounterparty {
  user_id?: number;
  name?: string | null;
  avatar?: string | null;
  job_title?: string | null;
  years_of_experience?: string | null;
}

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
      not_happened_note?: string;
    };

export interface UpdateReservationFeedbackRequest {
  rating: number;
  content: string;
}
