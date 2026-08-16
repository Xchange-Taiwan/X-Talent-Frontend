'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { getServerSession } from 'next-auth/next';

import authOptions from '@/auth.config';
import { hasUserProperties, isValidUserId } from '@/lib/auth/userGuard';
import { captureFlowFailure } from '@/lib/monitoring';
import { pollUntilUserDeleted } from '@/lib/profile/pollUntilSynced';

/**
 * Account-deletion variant of `revalidateProfilePath`
 * (`src/app/profile/[pageUserId]/actions.ts`). Lives here, not under that
 * route, because it acts on the caller's own session and has nothing to
 * do with a `[pageUserId]` route param.
 *
 * Returns immediately — the caller (the delete-account flow, right
 * before `signOut`) is never delayed by this call.
 *
 * Deliberately takes no arguments: the id and name it acts on are read
 * from the caller's own NextAuth session (JWT strategy, so this is a
 * cheap cookie decode, not a network round-trip), not from anything the
 * client passes in. An anonymous or unauthenticated request has no
 * session and this silently no-ops. This closes off what would otherwise
 * be a public amplification primitive — the deferred work below fires up
 * to `pollUntilUserDeleted`'s retry budget worth of Elasticsearch queries
 * per call, so letting a caller name an arbitrary target `userId` would
 * let anyone script repeated hits into a real search-index load problem,
 * on top of forcing `/mentor-pool` back to full SSR on every hit.
 * Deletion already only ever acts on the caller's own account (see
 * `deleteAccount`'s auth requirement), so scoping this the same way
 * matches what the action is actually for.
 *
 * The account is already deleted server-side by the time this runs, but
 * that's a separate system from the NextAuth session cookie (JWT
 * strategy) — the cookie stays valid, and readable here, until `signOut`
 * clears it right after this call.
 *
 * The actual cache purge is deferred via `after` to run on the server
 * *after* the response is sent, where it first polls until the mentor-pool
 * search index (Elasticsearch, updated async off an SQS queue) confirms
 * the deletion, then revalidates. A client-side poll can't do this here:
 * `signOut` triggers a hard browser navigation, which kills any in-flight
 * client JS before it could finish waiting. Running the wait server-side,
 * decoupled from the response via `after`, survives that.
 */
export async function revalidateProfilePathAfterDelete(): Promise<void> {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user;
  if (!hasUserProperties(sessionUser) || !isValidUserId(sessionUser.id)) {
    return;
  }

  const userId = sessionUser.id;
  const name = sessionUser.name ?? undefined;
  const numericUserId = Number(userId);

  after(async () => {
    // pollUntilUserDeleted never throws by contract (it swallows its own
    // fetch errors and returns false on timeout rather than rejecting),
    // but this guards that contract anyway: revalidation below must run
    // unconditionally. The account is already deleted server-side by this
    // point, so skipping the cache purge because *waiting* for the index
    // to catch up hit a snag would leave stale, already-deleted data
    // exposed on the cache indefinitely — worse than the race this whole
    // poll exists to close.
    try {
      await pollUntilUserDeleted(numericUserId, name);
    } catch (e) {
      captureFlowFailure({
        flow: 'delete_account',
        step: 'after_poll',
        message: e instanceof Error ? e.message : String(e),
        level: 'warning',
      });
    }

    // Each revalidatePath call is independently guarded so mentor-pool
    // still gets purged even if the profile-path one somehow throws (and
    // vice versa) — one failing must not take the other down with it.
    try {
      revalidatePath(`/profile/${userId}`);
    } catch (e) {
      captureFlowFailure({
        flow: 'delete_account',
        step: 'after_revalidate',
        message: e instanceof Error ? e.message : String(e),
        level: 'warning',
      });
    }

    try {
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
