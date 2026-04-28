'use server';

import { revalidatePath } from 'next/cache';

/**
 * Invalidate the ISR-cached SSR render of /profile/[userId] so the next
 * visitor (including the editor themselves on navigation) gets the
 * just-written data instead of a 60s-stale render. Called from
 * `useProfileSubmit` after the parallel-write step succeeds.
 *
 * Safe to call with any string id — `revalidatePath` no-ops on unknown
 * paths and never throws.
 */
export async function revalidateProfilePath(userId: string): Promise<void> {
  if (!userId) return;
  revalidatePath(`/profile/${userId}`);
}
