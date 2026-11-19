import { apiClient, BASE_URL } from '@/lib/apiClient';
import { normalizePositiveUserId } from '@/lib/profile/userId';
import type { components } from '@/types/api';
import type { MentorProfileVO } from '@/types/user';

export const REVALIDATE_SECONDS = 600;

export function getProfileCacheTag(userId: number | string): string {
  const normalized = normalizePositiveUserId(userId) ?? String(userId).trim();
  return `profile-${normalized}`;
}

export interface FetchUserByIdServerOptions {
  bypassCache?: boolean;
}

/**
 * Server-only mentor profile fetch for SSR rendering of /profile/[id].
 * Uses Next.js ISR (next.revalidate + profile-{id} cache tag) so concurrent
 * visitors hit the cache while `updateTag('profile-' + id)` immediately
 * purges stale role/profile snapshots on save (#974).
 *
 * Returns null when:
 *  - BASE_URL is unset (build-time prerender without .env) — lets the client
 *    take over at runtime instead of throwing during build,
 *  - the user does not exist (404 / API code !== '0') — caller should call
 *    notFound(),
 *  - any network or parse error — caller should treat as not-found.
 */
export async function fetchUserByIdServer(
  userId: number | string,
  language: string,
  options?: FetchUserByIdServerOptions
): Promise<MentorProfileVO | null> {
  if (!BASE_URL) return null;
  const normalizedUserId = normalizePositiveUserId(userId);
  if (!normalizedUserId) return null;
  try {
    const cacheConfig = options?.bypassCache
      ? ({ cache: 'no-store' } as const)
      : {
          next: {
            revalidate: REVALIDATE_SECONDS,
            tags: [getProfileCacheTag(normalizedUserId)],
          },
        };
    const data = await apiClient.getUnwrapped<
      components['schemas']['MentorProfileVO']
    >(`/v1/mentors/${normalizedUserId}/${language}/profile`, {
      auth: false,
      ...cacheConfig,
    });
    return data ?? null;
  } catch (error) {
    console.error('SSR fetchUserById error:', error);
    return null;
  }
}
