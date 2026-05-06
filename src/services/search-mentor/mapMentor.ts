import type { StaticImageData } from 'next/image';

import type { WorkExperienceMetadata } from '@/hooks/user/user-data/useUserData';
import type { components } from '@/types/api';

type RawMentor = components['schemas']['SearchMentorProfileVO'];

export type MentorListResponse =
  components['schemas']['ApiResponse_SearchMentorProfileListVO_'];

export type { WorkExperienceMetadata };

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

function readCodes(codes: ReadonlyArray<string> | null | undefined): string[] {
  if (!codes) return [];
  return codes.filter((c): c is string => Boolean(c));
}

export type MentorsType = components['schemas']['SearchMentorProfileListVO'];

export interface MentorRequest {
  searchPattern?: string;
  filter_skills?: string;
  filter_topics?: string;
  filter_industries?: string;
  limit: number;
  cursor?: string;
}

export function mapMentor(raw: RawMentor): MentorType {
  // Search emits industry as a flat subject_group string (OpenSearch keyword
  // mapping); the OpenAPI generator types it as `Record<string, never>`
  // because BFF inherits from MentorProfileVO whose industry is a Dict on
  // the User-service GET response. The runtime value is a string here.
  const industry = raw.industry as unknown as string | null | undefined;

  return {
    user_id: raw.user_id,
    name: raw.name ?? '',
    avatar: raw.avatar ?? '',
    job_title: raw.job_title ?? '',
    company: raw.company ?? '',
    years_of_experience: raw.years_of_experience ?? '',
    location: raw.location ?? '',
    personal_statement: raw.personal_statement ?? '',
    about: raw.about ?? '',
    seniority_level: raw.seniority_level ?? '',
    industry: industry ?? null,
    want_position: readCodes(raw.want_position),
    want_skill: readCodes(raw.want_skill),
    want_topic: readCodes(raw.want_topic),
    have_skill: readCodes(raw.have_skill),
    have_topic: readCodes(raw.have_topic),
    updated_at: raw.updated_at ?? null,
  };
}
