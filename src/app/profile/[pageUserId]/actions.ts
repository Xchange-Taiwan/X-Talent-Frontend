'use server';

import { revalidatePath } from 'next/cache';

import { isValidUserId } from '@/lib/auth/userGuard';

/**
 * Invalidate the ISR-cached SSR render of /profile/[userId] and the
 * mentor-pool fetch cache (`mentors.server.ts` uses `next: { revalidate }`
 * on the unfiltered list) so the next visitor — including the editor on
 * navigation — sees just-written profile data and the mentor card with
 * the new avatar / name / personal_statement etc. Called from
 * `useProfileSubmit` after the parallel-write step succeeds.
 *
 * Safe to call with any string id — invalid or unknown ids no-op and this
 * never throws.
 */
export async function revalidateProfilePath(userId: string): Promise<void> {
  if (!isValidUserId(userId)) return;
  revalidatePath(`/profile/${userId}`);
  revalidatePath('/mentor-pool');
}
