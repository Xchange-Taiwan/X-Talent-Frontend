'use server';

import { revalidatePath, updateTag } from 'next/cache';

import { isValidUserId } from '@/lib/auth/userGuard';
import { getProfileCacheTag } from '@/services/profile/user.server';

/**
 * Immediately expires the `profile-{userId}` fetch Data Cache tag via Next.js 16
 * `updateTag` (enabling read-your-own-writes across `/profile/[userId]` and
 * `/profile/card`) and purges ISR route caches for `/profile/[userId]`,
 * `/profile/card`, and `/mentor-pool` (#974).
 *
 * Safe to call with any string id — invalid or unknown ids no-op and this
 * never throws.
 */
export async function revalidateProfilePath(userId: string): Promise<void> {
  if (!isValidUserId(userId)) return;
  updateTag(getProfileCacheTag(userId));
  revalidatePath(`/profile/${userId}`);
  revalidatePath('/profile/card');
  revalidatePath('/mentor-pool');
}
