import { apiClient, BASE_URL } from '@/lib/apiClient';
import type { components } from '@/types/api';
import type { MentorProfileVO } from '@/types/user';

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
    const data = await apiClient.getUnwrapped<
      components['schemas']['MentorProfileVO']
    >(`/v1/mentors/${userId}/${language}/profile`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    return data ?? null;
  } catch (error) {
    console.error('SSR fetchUserById error:', error);
    return null;
  }
}
