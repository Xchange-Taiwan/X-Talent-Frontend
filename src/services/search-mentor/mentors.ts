import { StaticImageData } from 'next/image';

import { WorkExperienceMetadata } from '@/hooks/user/user-data/useUserData';
import { apiClient } from '@/lib/apiClient';
import { components } from '@/types/api';

type RawMentor = components['schemas']['SearchMentorProfileVO'];
type ExperienceCategory = components['schemas']['ExperienceCategory'];
type MentorListResponse =
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
  industry: string | null;
  expertises: string[];
  experiences: MentorExperienceBlock[];
  updated_at: number | null;
}

export type MentorsType = components['schemas']['SearchMentorProfileListVO'];

export interface MentorRequest {
  searchPattern?: string;
  filter_positions?: string;
  filter_skills?: string;
  filter_topics?: string;
  filter_expertises?: string;
  filter_industries?: string;
  limit: number;
  cursor?: string;
}

function mapMentor(raw: RawMentor): MentorType {
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
    interested_positions:
      raw.interested_positions?.interests?.map((i) => i.subject_group) ?? [],
    skills: raw.skills?.interests?.map((i) => i.subject_group) ?? [],
    topics: raw.topics?.interests?.map((i) => i.subject_group) ?? [],
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

export async function fetchMentors(
  param: MentorRequest
): Promise<MentorType[]> {
  try {
    const result = await apiClient.get<MentorListResponse>('/v1/mentors', {
      auth: false,
      params: param as unknown as Record<string, string | number | undefined>,
    });

    if (result.code !== '0') {
      console.error(`API Error: ${result.msg}`);
      return [];
    }
    return (result.data?.mentors ?? []).map(mapMentor);
  } catch (error) {
    console.error('Fetch Mentors Error:', error);
    return [];
  }
}
