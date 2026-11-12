import type { components } from '@/types/api';
import type { RawMentorStats } from '@/types/mentor';

export type MentorProfileVO = components['schemas']['MentorProfileVO'] & {
  stats?: RawMentorStats | null;
  completed_meeting_count?: number | null;
  total_rating_count?: number | null;
  rating_count?: number | null;
  rating_average?: number | null;
};
