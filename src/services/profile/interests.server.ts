import type { InterestsResult } from '@/hooks/user/interests/useInterests';
import type { components } from '@/types/api';

import type { InterestVO } from './interests';

type ApiResponse = components['schemas']['ApiResponse_InterestListVO_'];

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const REVALIDATE_SECONDS = 86400;

type InterestKind = 'INTERESTED_POSITION' | 'SKILL' | 'TOPIC';

async function fetchOneInterestServer(
  language: string,
  interest: InterestKind
): Promise<InterestVO[]> {
  if (!BASE_URL) return [];
  try {
    const url = new URL(`${BASE_URL}/v1/users/${language}/interests`);
    url.searchParams.set('interest', interest);
    const res = await fetch(url.toString(), {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      console.error(`SSR fetchInterests(${interest}) failed: ${res.status}`);
      return [];
    }
    const result = (await res.json()) as ApiResponse;
    return result.data?.interests ?? [];
  } catch (error) {
    console.error(`SSR fetchInterests(${interest}) error:`, error);
    return [];
  }
}

export async function fetchInterestsServer(
  language: string
): Promise<InterestsResult> {
  const [interestedPositions, skills, topics] = await Promise.all([
    fetchOneInterestServer(language, 'INTERESTED_POSITION'),
    fetchOneInterestServer(language, 'SKILL'),
    fetchOneInterestServer(language, 'TOPIC'),
  ]);

  // expertises/whatIOffers are vocabulary aliases — keep parity with the
  // client-side getInterestsCached so consumers can swap freely.
  return {
    interestedPositions,
    skills,
    topics,
    expertises: skills,
    whatIOffers: topics,
  };
}
