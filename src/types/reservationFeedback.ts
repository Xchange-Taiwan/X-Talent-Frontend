export const NOT_HAPPENED_REASONS = [
  'SCHEDULE_CONFLICT',
  'MENTOR_ABSENT',
  'MISSED_NOTIFICATION',
  'TECHNICAL_ISSUE',
  'OTHER',
] as const;

export type NotHappenedReason = (typeof NOT_HAPPENED_REASONS)[number];

export type FeedbackViewerRole = 'mentee' | 'mentor';

export const NOT_HAPPENED_REASON_LABELS: Record<NotHappenedReason, string> = {
  SCHEDULE_CONFLICT: '雙方時間無法配合',
  MENTOR_ABSENT: '對方未出席',
  MISSED_NOTIFICATION: '未收到或錯過會議通知',
  TECHNICAL_ISSUE: '技術／連線問題',
  OTHER: '其他',
};

export type FeedbackNextStep = 'ANSWER' | null;

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
