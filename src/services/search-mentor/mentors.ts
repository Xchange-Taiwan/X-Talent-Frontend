import { apiClient } from '@/lib/apiClient';
import type {
  MentorListWireResponse,
  MentorPage,
  MentorRequest,
} from '@/types/mentor';

import { mapMentorPage } from './mapMentor';

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

  return mapMentorPage(data);
}
