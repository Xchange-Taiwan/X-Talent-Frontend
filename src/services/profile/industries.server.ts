import type { components } from '@/types/api';

import type { ProfessionVO } from './industries';

type ApiResponse = components['schemas']['ApiResponse_ProfessionListVO_'];

// SSR_API_URL is preferred when set, so server-side fetches inside a
// Docker container can reach the BFF via the docker network DNS name
// (e.g. http://bff:8000/api), while the browser bundle still uses
// NEXT_PUBLIC_API_URL (e.g. http://localhost:8006/api).
const BASE_URL =
  process.env.SSR_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';
// Industry list is near-static; lazy 24h revalidate trades worst-case
// staleness for one shared cache entry instead of one per-user fetch.
const REVALIDATE_SECONDS = 86400;

export async function fetchIndustriesServer(
  language: string
): Promise<ProfessionVO[]> {
  // BASE_URL may be unset at build time. Skip silently so prerender doesn't
  // throw "Invalid URL"; client-side fallback in useIndustries takes over.
  if (!BASE_URL) return [];
  try {
    const res = await fetch(`${BASE_URL}/v1/users/${language}/industries`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      console.error(`SSR fetchIndustries failed: ${res.status}`);
      return [];
    }
    const result = (await res.json()) as ApiResponse;
    return result.data?.professions ?? [];
  } catch (error) {
    console.error('SSR fetchIndustries error:', error);
    return [];
  }
}
