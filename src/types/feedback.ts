export const DEFAULT_FEEDBACK_PAGE_SIZE = 10;

export interface RawMentorFeedbackItem {
  id?: string | number | null;
  feedback_id?: string | number | null;
  reservation_id?: string | number | null;
  author_name?: string | null;
  author_masked_name?: string | null;
  rating?: number | null;
  content?: string | null;
  created_at?: string | number | null;
}

export interface RawMentorFeedbackResponse {
  total_rating_count?: number | null;
  total?: number | null;
  rating_count?: number | null;
  rating_average?: number | null;
  completed_meeting_count?: number | null;
  page?: number | null;
  page_size?: number | null;
  feedbacks?: RawMentorFeedbackItem[] | null;
  items?: RawMentorFeedbackItem[] | null;
  feedback?: RawMentorFeedbackItem[] | null;
  reviews?: RawMentorFeedbackItem[] | null;
}

export interface MentorFeedbackItem {
  id: string;
  authorName: string;
  rating: number;
  content: string;
  createdAt: string | number | null;
}

export interface MentorFeedbackPage {
  items: MentorFeedbackItem[];
  totalRatingCount: number;
  page: number;
  pageSize: number;
  ratingAverage: number | null;
  completedMeetingCount: number | null;
  isFallbackEmpty?: boolean;
}

export interface FetchMentorFeedbackParams {
  mentorId: number;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}
