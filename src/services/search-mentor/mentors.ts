import { StaticImageData } from 'next/image';

import { apiClient } from '@/lib/apiClient';

export interface WorkExperienceMetadata {
  job?: string;
  company?: string;
  jobPeriodStart?: string;
  jobPeriodEnd?: string;
  jobLocation?: string;
  description?: string;
  industry?: string;
}

export interface MentorExperienceBlock {
  id: number;
  category: string;
  order: number;
  mentor_experiences_metadata?: { data?: WorkExperienceMetadata[] };
}

export interface MentorType {
  user_id: number;
  name: string;
  avatar: string | StaticImageData;
  job_title: string;
  company: string;
  years_of_experience: string;
  location: string;
  linkedin_profile: string;
  interested_positions: [];
  skills: [];
  topics: [];
  industry: string;
  language: string;
  personal_statement: string;
  about: string;
  seniority_level: string;
  expertises: [];
  experiences: MentorExperienceBlock[];
  created_at: string;
  updated_at: string;
}

export interface MentorsType {
  mentors: MentorType[];
  next_id: number;
}

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

interface MentorResponse {
  code: string;
  msg: string;
  data: MentorsType;
}

export async function fetchMentors(
  param: MentorRequest
): Promise<MentorType[]> {
  try {
    const result = await apiClient.get<MentorResponse>('/v1/mentors', {
      auth: false,
      params: param as unknown as Record<string, string | number | undefined>,
    });

    if (result.code !== '0') {
      console.error(`API Error: ${result.msg}`);
      return [];
    }
    return result.data.mentors;
  } catch (error) {
    console.error('Fetch Mentors Error:', error);
    return [];
  }
}
