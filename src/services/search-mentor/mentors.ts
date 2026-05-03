import { apiClient } from '@/lib/apiClient';

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
