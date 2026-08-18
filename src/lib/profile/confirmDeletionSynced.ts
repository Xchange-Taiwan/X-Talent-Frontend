import { revalidatePath } from 'next/cache';

import { captureFlowFailure } from '@/lib/monitoring';
import { pollUntilUserDeleted } from '@/lib/profile/pollUntilSynced';

// Deliberately a separate module from pollUntilSynced.ts, not an added
// export there: pollUntilSynced.ts is imported by saveProfile.ts, which
// flows into client-bundled code (useProfileSubmit.ts). `revalidatePath`
// is a Server Components/Server Actions-only API — importing it at that
// module's top level breaks the client bundle (Turbopack refuses to build
// it). This file exists to isolate that import to callers that are
// actually server-only, matching the pattern `src/actions/auth.ts` and
// `src/app/profile/[pageUserId]/actions.ts` already use.

/**
 * Owns the "confirm the mentor-pool search index no longer lists the
 * deleted user, then purge the profile/mentor-pool caches" sequence for
 * account deletion. Mirrors `revalidateProfilePath`
 * (`src/app/profile/[pageUserId]/actions.ts`) but scoped to the caller's
 * own account rather than a `[pageUserId]` route param — see that
 * function's own doc comment for why deletion doesn't reuse it directly.
 *
 * Each step is independently guarded so one failing (the poll, or either
 * `revalidatePath` call) doesn't skip the others — the account is already
 * deleted server-side by the time this runs, so every cache-purge step
 * must still attempt to run regardless of an earlier one's outcome.
 */
export async function confirmDeletionSynced(
  userId: number,
  userIdStr: string,
  name: string | undefined
): Promise<void> {
  try {
    await pollUntilUserDeleted(userId, name);
  } catch (e) {
    captureFlowFailure({
      flow: 'delete_account',
      step: 'after_poll',
      message: e instanceof Error ? e.message : String(e),
      level: 'warning',
    });
  }

  try {
    revalidatePath(`/profile/${userIdStr}`);
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
}
