import type { components } from '@/types/api';

import { mapMentor, type MentorRequest, type MentorType } from './mapMentor';

type MentorListResponse =
  components['schemas']['ApiResponse_SearchMentorProfileListVO_'];

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
// Unfiltered listing is shared by every visitor — keep ISR so LCP stays fast.
// Filtered/searched listings have unbounded cache-key combinations, so we
// bypass the data cache to avoid blowing up Next's fetch cache and the BFF.
//
// 10-minute TTL (vs the original 60s) is safe because profile submits now
// fire `revalidatePath('/mentor-pool')` (see profile/[pageUserId]/actions.ts),
// so any user-driven change is invalidated on demand. The TTL only bounds
// the staleness window for non-frontend-triggered changes (admin actions,
// search-index lag, account deletions that don't yet revalidate this path).
const REVALIDATE_SECONDS = 600;

function buildUrl(
  path: string,
  params?: Record<string, string | number | undefined | null>
): string {
  const url = `${BASE_URL}${path}`;
  if (!params) return url;
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value));
    }
  });
  const qs = query.toString();
  return qs ? `${url}?${qs}` : url;
}

function hasMentorRequestConditions(param: MentorRequest): boolean {
  return Boolean(
    param.searchPattern ||
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
    const fetchOptions: RequestInit = hasMentorRequestConditions(param)
      ? { cache: 'no-store' }
      : { next: { revalidate: REVALIDATE_SECONDS } };
    const res = await fetch(
      buildUrl(
        '/v1/mentors',
        param as unknown as Record<string, string | number | undefined>
      ),
      fetchOptions
    );
    if (!res.ok) {
      console.error(`SSR fetchMentors failed: ${res.status}`);
      return [];
    }
    const result = (await res.json()) as MentorListResponse;
    if (result.code !== '0') {
      console.error(`SSR fetchMentors API error: ${result.msg}`);
      return [];
    }
    return (result.data?.mentors ?? []).map(mapMentor);
  } catch (error) {
    console.error('SSR fetchMentors error:', error);
    return [];
  }
}
