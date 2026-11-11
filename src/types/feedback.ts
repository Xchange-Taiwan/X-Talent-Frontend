import type { RawMentorStats } from '@/types/mentor';

export interface RawMentorFeedbackItem {
  id?: string | number | null;
  feedback_id?: string | number | null;
  author_name?: string | null;
  rating?: number | null;
  content?: string | null;
  created_at?: string | number | null;
}

export interface RawMentorFeedbackResponse extends RawMentorStats {
  total_rating_count?: number | null;
  total?: number | null;
  rating_count?: number | null;
  page?: number | null;
  page_size?: number | null;
  limit?: number | null;
  items?: RawMentorFeedbackItem[] | null;
  feedbacks?: RawMentorFeedbackItem[] | null;
  feedback?: RawMentorFeedbackItem[] | null;
  reviews?: RawMentorFeedbackItem[] | null;
  stats?: RawMentorStats | null;
}

export interface MentorFeedbackItem {
  id: string;
  authorName: string;
  authorInitial: string;
  rating: number;
  content: string;
  createdAt: string;
  formattedDate: string;
}

export interface MentorFeedbackPage {
  items: MentorFeedbackItem[];
  totalRatingCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  ratingAverage: number | null;
  completedMeetingCount: number | null;
  isFallback: boolean;
}
