import { captureFlowFailure } from '@/lib/monitoring';

import {
  FAST_CONVERGENCE_BUDGET,
  type MentorCardFields,
  runConvergence,
  SearchIndexDeleteAdapter,
  SearchIndexSyncAdapter,
  type SearchMentorsFn,
} from './convergence';

export type { MentorCardFields };

export type PollMentorPoolSyncedFn = (
  userId: number,
  fields: MentorCardFields
) => Promise<boolean>;

export interface ConfirmProfileSyncOptions {
  maxRetries?: number;
  intervalMs?: number;
  searchMentors?: SearchMentorsFn;
  poll?: PollMentorPoolSyncedFn;
}

async function pollMentorPoolUntilDeleted(
  userId: number,
  name?: string,
  maxRetries = FAST_CONVERGENCE_BUDGET.maxRetries,
  intervalMs = FAST_CONVERGENCE_BUDGET.intervalMs
): Promise<boolean> {
  if (!userId || Number.isNaN(userId)) return true;

  const adapter = new SearchIndexDeleteAdapter(userId, name);
  const { confirmed } = await runConvergence(adapter, maxRetries, intervalMs);
  return confirmed;
}

async function pollMentorPoolUntilSynced(
  userId: number,
  fields: MentorCardFields,
  maxRetries = FAST_CONVERGENCE_BUDGET.maxRetries,
  intervalMs = FAST_CONVERGENCE_BUDGET.intervalMs,
  searchMentors?: SearchMentorsFn
): Promise<boolean> {
  if (!userId || Number.isNaN(userId)) return true;

  const adapter = new SearchIndexSyncAdapter(userId, fields, searchMentors);
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
  optionsOrPoll?: ConfirmProfileSyncOptions | PollMentorPoolSyncedFn
): Promise<void> {
  if (!isMentorRelevant) return;
  const poll: PollMentorPoolSyncedFn =
    typeof optionsOrPoll === 'function'
      ? optionsOrPoll
      : (optionsOrPoll?.poll ??
        ((id, cardFields) =>
          pollMentorPoolUntilSynced(
            id,
            cardFields,
            optionsOrPoll?.maxRetries,
            optionsOrPoll?.intervalMs,
            optionsOrPoll?.searchMentors
          )));

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
  ) => Promise<boolean> = pollMentorPoolUntilDeleted
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
