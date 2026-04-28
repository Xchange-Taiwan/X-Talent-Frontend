import type { StaticImageData } from 'next/image';

import type { WorkExperienceMetadata } from '@/hooks/user/user-data/useUserData';
import { parseCurrentJob } from '@/lib/profile/parseUserExperiences';
import type { components } from '@/types/api';

type RawMentor = components['schemas']['SearchMentorProfileVO'];
type ExperienceCategory = components['schemas']['ExperienceCategory'];

export type MentorListResponse =
  components['schemas']['ApiResponse_SearchMentorProfileListVO_'];

export type { WorkExperienceMetadata };

export interface MentorExperienceBlock {
  id: number;
  category: ExperienceCategory;
  order: number;
  mentor_experiences_metadata?: Record<string, unknown>;
}

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
  interested_positions: string[];
  skills: string[];
  topics: string[];
  what_i_offers: string[];
  industry: string | null;
  expertises: string[];
  experiences: MentorExperienceBlock[];
  updated_at: number | null;
}

type WhatIOfferMetadataEntry = { subject_group?: string };
type WhatIOfferMetadata = { data?: WhatIOfferMetadataEntry[] };

function extractWhatIOfferGroups(
  experiences: RawMentor['experiences']
): string[] {
  const groups = (experiences ?? [])
    .filter((e) => e.category === 'WHAT_I_OFFER')
    .flatMap(
      (e) =>
        (e.mentor_experiences_metadata as WhatIOfferMetadata | undefined)
          ?.data ?? []
    )
    .map((entry) => entry.subject_group)
    .filter((g): g is string => Boolean(g));

  return Array.from(new Set(groups));
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
  const { job_title, company } = parseCurrentJob(
    raw.experiences as
      | { category?: string | null; mentor_experiences_metadata: unknown }[]
      | null
      | undefined
  );

  return {
    user_id: raw.user_id,
    name: raw.name ?? '',
    avatar: raw.avatar ?? '',
    job_title,
    company,
    years_of_experience: raw.years_of_experience ?? '',
    location: raw.location ?? '',
    personal_statement: raw.personal_statement ?? '',
    about: raw.about ?? '',
    seniority_level: raw.seniority_level ?? '',
    interested_positions:
      raw.interested_positions?.interests?.map((i) => i.subject_group) ?? [],
    skills: raw.skills?.interests?.map((i) => i.subject_group) ?? [],
    topics: raw.topics?.interests?.map((i) => i.subject_group) ?? [],
    what_i_offers: extractWhatIOfferGroups(raw.experiences),
    industry: raw.industry?.subject ?? null,
    expertises: raw.expertises?.professions?.map((p) => p.subject) ?? [],
    experiences: (raw.experiences ?? []).map((e) => ({
      id: e.id,
      category: e.category ?? 'WORK',
      order: e.order,
      mentor_experiences_metadata: e.mentor_experiences_metadata as Record<
        string,
        unknown
      >,
    })),
    updated_at: raw.updated_at ?? null,
  };
}
