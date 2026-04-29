import type { components } from '@/types/api';

import type { ProfessionVO } from './expertises';

type ApiResponse = components['schemas']['ApiResponse_ProfessionListVO_'];

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const REVALIDATE_SECONDS = 86400;

export async function fetchExpertisesServer(
  language: string
): Promise<ProfessionVO[]> {
  if (!BASE_URL) return [];
  try {
    const res = await fetch(`${BASE_URL}/v1/mentors/${language}/expertises`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      console.error(`SSR fetchExpertises failed: ${res.status}`);
      return [];
    }
    const result = (await res.json()) as ApiResponse;
    return result.data?.professions ?? [];
  } catch (error) {
    console.error('SSR fetchExpertises error:', error);
    return [];
  }
}
