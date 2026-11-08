import { apiClient } from '@/lib/apiClient';
import type { components } from '@/types/api';
import type { MentorRequest, MentorType } from '@/types/mentor';

import { mapMentor } from './mapMentor';

export async function fetchMentors(
  param: MentorRequest,
  signal?: AbortSignal
): Promise<MentorType[]> {
  const data = await apiClient.getUnwrapped<
    components['schemas']['SearchMentorProfileListVO']
  >('/v1/mentors', {
    auth: false,
    params: param as unknown as Record<string, string | number | undefined>,
    signal,
  });

  return (data?.mentors ?? []).map(mapMentor);
}
