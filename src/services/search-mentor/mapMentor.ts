import type { StaticImageData } from 'next/image';

import type { WorkExperienceMetadata } from '@/hooks/user/user-data/useUserData';
import type { components } from '@/types/api';

type RawMentor = components['schemas']['SearchMentorProfileVO'];
type TagVO = components['schemas']['TagVO'];

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

// OpenAPI types these as TagVO[], but the search index actually returns a
// flat string[] of subject_group codes (e.g. ["promotion_review"]). Accept
// both — for codes, the consumer is responsible for translating to a
// localized label via the tag catalog.
function readTagLabels(
  tags: ReadonlyArray<TagVO | string> | null | undefined
): string[] {
  if (!tags) return [];
  return tags
    .map((t) =>
      typeof t === 'string' ? t : (t.subject ?? t.subject_group ?? '')
    )
    .filter((s): s is string => Boolean(s));
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
    // OpenAPI schema types `industry` as ProfessionVO, but the search index
    // returns it as a flat subject_group code string (e.g. "culture_education").
    // Handle both shapes so we don't silently drop the value.
    industry:
      typeof raw.industry === 'string'
        ? raw.industry
        : (raw.industry?.subject_group ?? null),
    want_position: readTagLabels(raw.want_position),
    want_skill: readTagLabels(raw.want_skill),
    want_topic: readTagLabels(raw.want_topic),
    have_skill: readTagLabels(raw.have_skill),
    have_topic: readTagLabels(raw.have_topic),
    updated_at: raw.updated_at ?? null,
  };
}
