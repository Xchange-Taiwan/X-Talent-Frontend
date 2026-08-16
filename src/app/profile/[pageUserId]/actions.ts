'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

import { captureFlowFailure } from '@/lib/monitoring';
import { pollUntilUserDeleted } from '@/lib/profile/pollUntilSynced';

// Both actions below are callable directly (Server Actions are just POST
// endpoints under the hood) with any string, bypassing whatever UI
// normally supplies `userId`. Without this check, a crafted id like
// `../about` would make `revalidatePath` purge an arbitrary route, not
// just this user's profile — a free-standing cache-busting primitive an
// attacker could hammer to force the site back to full SSR on every hit.
function isValidUserId(userId: string): boolean {
  return /^\d+$/.test(userId);
}

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
 *
 * `name`, when available, scopes the poll to a search-pattern match
 * instead of scanning the unfiltered listing — see `pollUntilUserDeleted`.
 */
export async function revalidateProfilePathAfterDelete(
  userId: string,
  name?: string
): Promise<void> {
  if (!isValidUserId(userId)) return;
  const numericUserId = Number(userId);

  after(async () => {
    try {
      await pollUntilUserDeleted(numericUserId, name);
      revalidatePath(`/profile/${userId}`);
      revalidatePath('/mentor-pool');
    } catch (e) {
      captureFlowFailure({
        flow: 'delete_account',
        step: 'after_revalidate',
        message: e instanceof Error ? e.message : String(e),
        level: 'warning',
      });
    }
  });
}
