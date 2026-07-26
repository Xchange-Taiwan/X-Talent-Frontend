import { apiClient } from '@/lib/apiClient';
import type { components } from '@/types/api';

import {
  mapMentor,
  type MentorListResponse,
  type MentorRequest,
  type MentorsType,
  type MentorType,
  type WorkExperienceMetadata,
} from './mapMentor';

export type {
  MentorListResponse,
  MentorRequest,
  MentorsType,
  MentorType,
  WorkExperienceMetadata,
};

export async function fetchMentors(
  param: MentorRequest
): Promise<MentorType[]> {
  try {
    const data = await apiClient.getUnwrapped<
      components['schemas']['SearchMentorProfileListVO']
    >('/v1/mentors', {
      auth: false,
      params: param as unknown as Record<string, string | number | undefined>,
    });

    return (data?.mentors ?? []).map(mapMentor);
  } catch (error) {
    console.error('Fetch Mentors Error:', error);
    return [];
  }
}
