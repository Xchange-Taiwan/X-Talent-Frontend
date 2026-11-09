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
  // Current BFF emits ISO-8601. number remains only for legacy fixtures while
  // the generated OpenAPI client is regenerated from the additive BE release.
  updated_at: string | number | null;
}

export interface MentorPage {
  mentors: MentorType[];
  nextCursor: string | null;
}

/** @deprecated Only retained for internal callers/tests during the API cutover. */
export type MentorPageResult = MentorPage | MentorType[];

export function asMentorPage(result: MentorPageResult): MentorPage {
  return Array.isArray(result) ? { mentors: result, nextCursor: null } : result;
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
