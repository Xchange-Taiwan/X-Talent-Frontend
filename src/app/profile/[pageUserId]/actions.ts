'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

import { pollUntilUserDeleted } from '@/lib/profile/pollUntilSynced';

/**
 * Invalidate the ISR-cached SSR render of /profile/[userId] and the
 * mentor-pool fetch cache (`mentors.server.ts` uses `next: { revalidate }`
 * on the unfiltered list) so the next visitor — including the editor on
 * navigation — sees just-written profile data and the mentor card with
 * the new avatar / name / personal_statement etc. Called from
 * `useProfileSubmit` after the parallel-write step succeeds.
 *
 * Safe to call with any string id — `revalidatePath` no-ops on unknown
 * paths and never throws.
 */
export async function revalidateProfilePath(userId: string): Promise<void> {
  if (!userId) return;
  revalidatePath(`/profile/${userId}`);
  revalidatePath('/mentor-pool');
}

/**
 * Account-deletion variant of `revalidateProfilePath`. Returns immediately
 * — the caller (the delete-account flow, right before `signOut`) is never
 * delayed by this call.
 *
 * The actual cache purge is deferred via `after` to run on the server
 * *after* the response is sent, where it first polls until the mentor-pool
 * search index (Elasticsearch, updated async off an SQS queue) confirms
 * the deletion, then revalidates. A client-side poll can't do this here:
 * `signOut` triggers a hard browser navigation, which kills any in-flight
 * client JS before it could finish waiting. Running the wait server-side,
 * decoupled from the response via `after`, survives that.
 */
export async function revalidateProfilePathAfterDelete(
  userId: string
): Promise<void> {
  if (!userId) return;
  const numericUserId = Number(userId);

  after(async () => {
    await pollUntilUserDeleted(numericUserId);
    revalidatePath(`/profile/${userId}`);
    revalidatePath('/mentor-pool');
  });
}
