import { apiClient, BASE_URL, type RequestOptions } from '@/lib/apiClient';
import {
  isUnfilteredMentorPoolQuery,
  toMentorRequest,
} from '@/lib/mentor/mentorPoolQuery';
import type {
  MentorListWireResponse,
  MentorPage,
  MentorRequest,
} from '@/types/mentor';

import { mapMentorPage } from './mapMentor';

const REVALIDATE_SECONDS = 60 * 60 * 24;

function buildMentorRequestOptions(
  param: MentorRequest,
  extraOptions?: Omit<RequestOptions, 'auth' | 'params'>
): RequestOptions {
  const canonical = toMentorRequest(param, {
    limit: param.limit,
    cursor: param.cursor,
  });

  const params: NonNullable<RequestOptions['params']> = {
    search_pattern: canonical.search_pattern,
    limit: canonical.limit,
  };
  if (canonical.filter_industries) {
    params.filter_industries = canonical.filter_industries;
  }
  if (canonical.filter_skills) {
    params.filter_skills = canonical.filter_skills;
  }
  if (canonical.filter_topics) {
    params.filter_topics = canonical.filter_topics;
  }
  if (canonical.sort_by) {
    params.sort_by = canonical.sort_by;
  }
  if (canonical.cursor) {
    params.cursor = canonical.cursor;
  }

  return {
    auth: false,
    params,
    ...extraOptions,
  };
}

export async function fetchMentors(
  param: MentorRequest,
  signal?: AbortSignal
): Promise<MentorPage> {
  const data = await apiClient.getUnwrapped<MentorListWireResponse>(
    '/v1/mentors',
    buildMentorRequestOptions(param, { signal })
  );

  return mapMentorPage(data);
}

export async function fetchMentorsServer(
  param: MentorRequest
): Promise<MentorPage> {
  // BASE_URL may be unset at build time (no .env.production* / .env.local).
  // Skip silently — the SSR-empty result lets the client take over at runtime
  // with the proper env, instead of throwing a noisy "Invalid URL" during
  // build prerender.
  if (!BASE_URL) return mapMentorPage();

  const isUnfiltered = isUnfilteredMentorPoolQuery(param) && !param.cursor;
  const fetchOptions: Omit<RequestOptions, 'auth' | 'params'> = isUnfiltered
    ? { next: { revalidate: REVALIDATE_SECONDS } }
    : { cache: 'no-store' };

  const data = await apiClient.getUnwrapped<MentorListWireResponse>(
    '/v1/mentors',
    buildMentorRequestOptions(param, fetchOptions)
  );

  return mapMentorPage(data);
}
