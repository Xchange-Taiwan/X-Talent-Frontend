import type { components } from '@/types/api';

import { mapMentor, type MentorRequest, type MentorType } from './mapMentor';

type MentorListResponse =
  components['schemas']['ApiResponse_SearchMentorProfileListVO_'];
type InterestListResponse =
  components['schemas']['ApiResponse_InterestListVO_'];

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
// Unfiltered listing is shared by every visitor — keep ISR so LCP stays fast.
// Filtered/searched listings have unbounded cache-key combinations, so we
// bypass the data cache to avoid blowing up Next's fetch cache and the BFF.
const REVALIDATE_SECONDS = 60;

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

async function fetchInterestLabelMapServer(
  language: string,
  interest: 'SKILL' | 'TOPIC'
): Promise<Record<string, string>> {
  if (!BASE_URL) return {};
  try {
    const res = await fetch(
      buildUrl(`/v1/users/${language}/interests`, { interest }),
      { next: { revalidate: REVALIDATE_SECONDS } }
    );
    if (!res.ok) return {};
    const data = (await res.json()) as InterestListResponse;
    const map: Record<string, string> = {};
    (data.data?.interests ?? []).forEach((s) => {
      map[s.subject_group] = s.subject ?? '';
    });
    return map;
  } catch (error) {
    console.error('SSR fetchInterestLabelMap error:', error);
    return {};
  }
}

export async function fetchMentorsEnrichedServer(
  param: MentorRequest
): Promise<MentorType[]> {
  const [searchResults, skillLabelMap, topicLabelMap] = await Promise.all([
    fetchMentorsServer(param),
    fetchInterestLabelMapServer('zh_TW', 'SKILL'),
    fetchInterestLabelMapServer('zh_TW', 'TOPIC'),
  ]);

  if (searchResults.length === 0) return [];

  return searchResults.map((mentor) => ({
    ...mentor,
    skills: mentor.skills
      .map((subjectGroup) => skillLabelMap[subjectGroup] ?? subjectGroup)
      .filter(Boolean),
    topics: mentor.topics
      .map((subjectGroup) => topicLabelMap[subjectGroup] ?? subjectGroup)
      .filter(Boolean),
    what_i_offers: mentor.what_i_offers
      .map((subjectGroup) => topicLabelMap[subjectGroup] ?? subjectGroup)
      .filter(Boolean),
  }));
}
