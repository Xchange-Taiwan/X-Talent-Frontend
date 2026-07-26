import { BASE_URL, fetchServerJson } from '@/lib/apiClient';
import type { components } from '@/types/api';

import { mapMentor, type MentorRequest, type MentorType } from './mapMentor';

const REVALIDATE_SECONDS = 60 * 60 * 24;

function hasMentorRequestConditions(param: MentorRequest): boolean {
  return Boolean(
    param.search_pattern ||
    param.filter_skills ||
    param.filter_topics ||
    param.filter_industries
  );
}

export async function fetchMentorsServer(
  param: MentorRequest
): Promise<MentorType[]> {
  // BASE_URL may be unset at build time (no .env.production* / .env.local).
  // Skip silently — the SSR-empty result lets the client take over at runtime
  // with the proper env, instead of throwing a noisy "Invalid URL" during
  // build prerender.
  if (!BASE_URL) return [];
  try {
    const fetchOptions = hasMentorRequestConditions(param)
      ? { cache: 'no-store' as const }
      : { next: { revalidate: REVALIDATE_SECONDS } };

    const data = await fetchServerJson<
      components['schemas']['SearchMentorProfileListVO']
    >('/v1/mentors', {
      params: param as unknown as Record<
        string,
        string | number | boolean | undefined | null
      >,
      ...fetchOptions,
    });

    return (data?.mentors ?? []).map(mapMentor);
  } catch (error) {
    console.error('SSR fetchMentors error:', error);
    return [];
  }
}
