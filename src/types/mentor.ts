import type { StaticImageData } from 'next/image';

import type { components } from '@/types/api';

export interface MentorStats {
  completed_meeting_count: number;
  rating_count: number;
  rating_average: number | null;
}

export interface RawMentorStats {
  completed_meeting_count?: number | null;
  rating_count?: number | null;
  rating_average?: number | null;
}

export type RawMentor = Omit<
  components['schemas']['SearchMentorProfileVO'],
  'updated_at'
> & {
  updated_at?: string | number | null;
  stats?: RawMentorStats | null;
  completed_meeting_count?: number | null;
  rating_count?: number | null;
  rating_average?: number | null;
};

export type MentorListWireResponse = Omit<
  components['schemas']['SearchMentorProfileListVO'],
  'mentors' | 'next_cursor'
> & {
  mentors?: RawMentor[];
  next_cursor?: string | null;
};

export interface MentorType {
  user_id: number;
  name: string;
  avatar: string | StaticImageData;
  job_title: string;
  company: string;
  years_of_experience: string;
  location: string;
  personal_statement: string;
  about: string;
  seniority_level: string;
  industry: string | null;
  want_position: string[];
  want_skill: string[];
  want_topic: string[];
  have_skill: string[];
  have_topic: string[];
  updated_at: string | null;
  stats?: MentorStats | null;
}

export interface MentorPage {
  mentors: MentorType[];
  nextCursor: string | null;
}

export interface MentorRequest {
  search_pattern?: string;
  filter_skills?: string;
  filter_topics?: string;
  filter_industries?: string;
  sort_by?: 'recent' | 'popularity';
  limit: number;
  cursor?: string;
}
