import type { StaticImageData } from 'next/image';

import type { components } from '@/types/api';

export type RawMentor = components['schemas']['SearchMentorProfileVO'];

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
  updated_at: number | null;
}

export interface MentorRequest {
  search_pattern?: string;
  filter_skills?: string;
  filter_topics?: string;
  filter_industries?: string;
  limit: number;
  cursor?: string;
}
