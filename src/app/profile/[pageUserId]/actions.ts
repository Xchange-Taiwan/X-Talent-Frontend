'use server';

import { revalidatePath, updateTag } from 'next/cache';

import { isValidUserId } from '@/lib/auth/userGuard';
import { normalizePositiveUserId } from '@/lib/profile/userId';
import { getProfileCacheTag } from '@/services/profile/user.server';
import { MENTOR_POOL_CACHE_TAG } from '@/services/search-mentor/mentors';

/**
 * Immediately expires both `profile-{userId}` and `mentor-pool` fetch Data Cache
 * tags via Next.js 16 `updateTag` (enabling read-your-own-writes across
 * `/profile/[userId]`, `/profile/card`, and `/mentor-pool`) and purges ISR route
 * caches (#974).
 *
 * Safe to call with any string id — invalid or unknown ids no-op and this
 * never throws.
 */
export async function revalidateProfilePath(userId: string): Promise<void> {
  if (!isValidUserId(userId)) return;
  const normalizedUserId = normalizePositiveUserId(userId);
  if (!normalizedUserId) return;
  updateTag(getProfileCacheTag(normalizedUserId));
  updateTag(MENTOR_POOL_CACHE_TAG);
  revalidatePath(`/profile/${normalizedUserId}`);
  revalidatePath('/profile/card');
  revalidatePath('/mentor-pool');
}
