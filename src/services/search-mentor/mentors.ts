import { apiClient } from '@/lib/apiClient';
import type { components } from '@/types/api';
import type { MentorPage, MentorRequest } from '@/types/mentor';

import { mapMentor, type RawMentor } from './mapMentor';

type MentorListWireResponse = Omit<
  components['schemas']['SearchMentorProfileListVO'],
  'mentors'
> & {
  mentors?: RawMentor[];
  next_cursor?: string | null;
};

export async function fetchMentors(
  param: MentorRequest,
  signal?: AbortSignal
): Promise<MentorPage> {
  const data = await apiClient.getUnwrapped<MentorListWireResponse>(
    '/v1/mentors',
    {
      auth: false,
      params: param as unknown as Record<string, string | number | undefined>,
      signal,
    }
  );

  return {
    mentors: (data?.mentors ?? []).map((mentor) => mapMentor(mentor)),
    nextCursor: data?.next_cursor ?? null,
  };
}
