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
export const MENTOR_POOL_CACHE_TAG = 'mentor-pool';

function buildMentorRequestOptions(
  param: MentorRequest,
  extraOptions?: Omit<RequestOptions, 'auth' | 'params'>
): RequestOptions {
  const canonical = toMentorRequest(param, {
    limit: param.limit,
    cursor: param.cursor,
  });

  return {
    auth: false,
    params: { ...canonical },
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
    ? {
        next: {
          revalidate: REVALIDATE_SECONDS,
          tags: [MENTOR_POOL_CACHE_TAG],
        },
      }
    : { cache: 'no-store' };

  const data = await apiClient.getUnwrapped<MentorListWireResponse>(
    '/v1/mentors',
    buildMentorRequestOptions(param, fetchOptions)
  );

  return mapMentorPage(data);
}
