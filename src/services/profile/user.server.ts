import type { components } from '@/types/api';

import type { MentorProfileVO } from './user';

type ApiResponseMentorProfileVO =
  components['schemas']['ApiResponse_MentorProfileVO_'];

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
// Profile pages are read-heavy and per-user-id; ISR caches each id for 60s so
// concurrent visitors share one BFF call. Edit submit calls revalidatePath to
// invalidate this entry on demand.
const REVALIDATE_SECONDS = 60;

/**
 * Server-only mentor profile fetch for SSR rendering of /profile/[id].
 * Uses Next.js ISR (next.revalidate) so concurrent visitors hit the cache.
 *
 * Returns null when:
 *  - BASE_URL is unset (build-time prerender without .env) — lets the client
 *    take over at runtime instead of throwing during build,
 *  - the user does not exist (404 / API code !== '0') — caller should call
 *    notFound(),
 *  - any network or parse error — caller should treat as not-found.
 */
export async function fetchUserByIdServer(
  userId: number,
  language: string
): Promise<MentorProfileVO | null> {
  if (!BASE_URL) return null;
  try {
    const res = await fetch(
      `${BASE_URL}/v1/mentors/${userId}/${language}/profile`,
      { next: { revalidate: REVALIDATE_SECONDS } }
    );
    if (!res.ok) {
      console.error(`SSR fetchUserById failed: ${res.status}`);
      return null;
    }
    const result = (await res.json()) as ApiResponseMentorProfileVO;
    if (result.code !== '0') {
      console.error(`SSR fetchUserById API error: ${result.msg}`);
      return null;
    }
    return result.data ?? null;
  } catch (error) {
    console.error('SSR fetchUserById error:', error);
    return null;
  }
}
