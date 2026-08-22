import { captureFlowFailure } from '@/lib/monitoring';
import { ProfileFormValues } from '@/schemas/profileSchema';
import type { MentorProfileVO } from '@/types/user';

import {
  CONVERGENCE_BUDGET,
  type MentorCardFields,
  ProfileRecordAdapter,
  runConvergence,
  SearchIndexDeleteAdapter,
  SearchIndexSyncAdapter,
} from './convergence';

export type { MentorCardFields };

/**
 * Single, fast attempt to read the latest profile and confirm it matches the
 * just-submitted values, bounded by `timeoutMs`. Used by submit handlers to
 * prime caches before navigation so the next page can render from cache
 * without a fresh API call.
 *
 * Returns the synced MentorProfileVO on success, or null if:
 *   - the backend has not synced yet,
 *   - fetch failed, or
 *   - the call did not complete within `timeoutMs`.
 *
 * Never throws. On null, callers fall back to the slower `pollUntilSynced`
 * background reconcile path so the user is not blocked on backend latency.
 */
export async function firstSyncedFetch(
  userId: number,
  values: ProfileFormValues,
  avatar: string,
  timeoutMs = 800
): Promise<MentorProfileVO | null> {
  if (!userId || Number.isNaN(userId)) return null;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });

  const adapter = new ProfileRecordAdapter(userId, values, avatar);

  const fetchPromise = adapter
    .fetch()
    .then((latest) => {
      if (latest && adapter.isCaughtUp(latest)) return latest;
      return null;
    })
    .catch(() => null);

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Polls fetchUserById until the backend reflects the submitted values, or the
 * retry budget is exhausted. Designed for fire-and-forget background use:
 * never throws, and reports a Sentry breadcrumb if max retries elapse
 * without sync.
 */
export async function pollUntilSynced(
  userId: number,
  values: ProfileFormValues,
  avatar: string,
  maxRetries = CONVERGENCE_BUDGET.maxRetries,
  intervalMs = CONVERGENCE_BUDGET.intervalMs
): Promise<MentorProfileVO | null> {
  if (!userId || Number.isNaN(userId)) return null;

  const adapter = new ProfileRecordAdapter(userId, values, avatar);
  const { latest } = await runConvergence(adapter, maxRetries, intervalMs);
  return latest;
}

/**
 * Polls the mentor-pool search query until this user no longer appears in
 * it. Called before `revalidatePath('/mentor-pool')` on account deletion
 * so the fresh SSR fetch that revalidation triggers doesn't re-cache a
 * stale result.
 */
export async function pollUntilUserDeleted(
  userId: number,
  name?: string,
  maxRetries = CONVERGENCE_BUDGET.maxRetries,
  intervalMs = CONVERGENCE_BUDGET.intervalMs
): Promise<boolean> {
  if (!userId || Number.isNaN(userId)) return true;

  const adapter = new SearchIndexDeleteAdapter(userId, name);
  const { confirmed } = await runConvergence(adapter, maxRetries, intervalMs);
  return confirmed;
}

/**
 * Polls the mentor-pool search query (scoped to `fields.name` via
 * `search_pattern`, so it isn't limited to the unfiltered listing's first
 * page) until this user's card reflects every just-saved, card-visible
 * field (or, for a user newly becoming a mentor, until the card appears
 * at all). Only meaningful for mentors — callers should skip this for
 * mentee saves, since those never appear in the listing.
 */
export async function pollUntilMentorPoolSynced(
  userId: number,
  fields: MentorCardFields,
  maxRetries = CONVERGENCE_BUDGET.maxRetries,
  intervalMs = CONVERGENCE_BUDGET.intervalMs
): Promise<boolean> {
  if (!userId || Number.isNaN(userId)) return true;

  const adapter = new SearchIndexSyncAdapter(userId, fields);
  const { confirmed } = await runConvergence(adapter, maxRetries, intervalMs);
  return confirmed;
}

/**
 * Owns the "confirm the mentor-pool search index reflects this save, then
 * revalidate" sequence for the profile-update flow — the single place this
 * poll-then-revalidate pairing lives, instead of being hand-sequenced at
 * each call site. A no-op when the save isn't mentor-relevant: skips the
 * confirmation poll entirely and never re-invokes `revalidate`, since the
 * immediate revalidate the caller already fired (its own concern, not
 * this function's) already covers a mentee save.
 */
export async function confirmProfileSynced(
  userId: number,
  fields: MentorCardFields,
  isMentorRelevant: boolean,
  revalidate: () => Promise<void>,
  poll: (
    userId: number,
    fields: MentorCardFields
  ) => Promise<boolean> = pollUntilMentorPoolSynced
): Promise<void> {
  if (!isMentorRelevant) return;
  try {
    await poll(userId, fields);
  } catch (e) {
    captureFlowFailure({
      flow: 'profile_update',
      step: 'poll_mentor_pool_sync_error',
      message: e instanceof Error ? e.message : String(e),
      level: 'warning',
    });
  }
  await revalidate();
}

/**
 * Owns the "confirm the mentor-pool search index no longer lists the
 * deleted user, then purge the profile/mentor-pool caches" sequence for
 * account deletion. Mirrors `revalidateProfilePath`
 * (`src/app/profile/[pageUserId]/actions.ts`) but scoped to the caller's
 * own account rather than a `[pageUserId]` route param — see that
 * function's own doc comment for why deletion doesn't reuse it directly.
 */
export async function confirmDeletionSynced(
  userId: number,
  name: string | undefined,
  revalidatePaths: Array<() => void>,
  poll: (
    userId: number,
    name?: string
  ) => Promise<boolean> = pollUntilUserDeleted
): Promise<void> {
  try {
    await poll(userId, name);
  } catch (e) {
    captureFlowFailure({
      flow: 'delete_account',
      step: 'after_poll',
      message: e instanceof Error ? e.message : String(e),
      level: 'warning',
    });
  }

  for (const revalidate of revalidatePaths) {
    try {
      revalidate();
    } catch (e) {
      captureFlowFailure({
        flow: 'delete_account',
        step: 'after_revalidate',
        message: e instanceof Error ? e.message : String(e),
        level: 'warning',
      });
    }
  }
}
