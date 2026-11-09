import type { StaticImageData } from 'next/image';

import type { components } from '@/types/api';

export type RawMentor = Omit<
  components['schemas']['SearchMentorProfileVO'],
  'updated_at'
> & {
  updated_at?: string | number | null;
};

export type MentorListWireResponse = Omit<
  components['schemas']['SearchMentorProfileListVO'],
  'mentors' | 'next_id'
> & {
  mentors?: RawMentor[];
  next_id?: number | null;
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
