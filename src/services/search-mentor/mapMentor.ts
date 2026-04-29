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

// The OpenAPI schema declares `topics` as `InterestListVO` (i.e.
// `{ interests: InterestVO[] }`), but `/v1/mentors` actually returns a flat
// `InterestVO[]`. Read it as an array so the field is not silently empty.
type InterestEntry = { subject_group?: string | null };
function readInterestGroups(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return (raw as InterestEntry[])
    .map((i) => i.subject_group)
    .filter((g): g is string => Boolean(g));
}

type WhatIOfferDataItem = { subject_group?: string | null };
function readWhatIOfferGroups(raw: RawMentor['experiences']): string[] {
  if (!raw) return [];
  const subjectGroups = raw
    .filter((e) => e.category === 'WHAT_I_OFFER')
    .flatMap((e) => {
      const metadata = e.mentor_experiences_metadata as
        | { data?: WhatIOfferDataItem[] }
        | undefined;
      return metadata?.data ?? [];
    })
    .map((item) => item.subject_group)
    .filter((g): g is string => Boolean(g));
  return Array.from(new Set(subjectGroups));
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
    interested_positions: readInterestGroups(raw.interested_positions),
    skills: readInterestGroups(raw.skills),
    topics: readInterestGroups(raw.topics),
    what_i_offers: readWhatIOfferGroups(raw.experiences),
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
