import { PAGE_LIMIT } from '@/app/mentor-pool/constants';
import { captureFlowFailure } from '@/lib/monitoring';
import { isProfileSynced } from '@/lib/profile/profileSaveAdapter';
import { ProfileFormValues } from '@/schemas/profileSchema';
import { fetchUserById } from '@/services/profile/user';
import { fetchMentors } from '@/services/search-mentor/mentors';
import type { MentorProfileVO } from '@/types/user';

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

  const fetchPromise = fetchUserById(userId, 'zh_TW', undefined, true)
    .then((latest) => {
      if (latest && isProfileSynced(values, latest, avatar)) return latest;
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
  maxRetries = 12,
  intervalMs = 5000
): Promise<MentorProfileVO | null> {
  if (!userId || Number.isNaN(userId)) return null;

  let latest: MentorProfileVO | null = null;
  let synced = false;

  for (let i = 0; i < maxRetries; i++) {
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    try {
      latest = await fetchUserById(userId, 'zh_TW', undefined, true);
    } catch {
      latest = null;
    }
    if (latest && isProfileSynced(values, latest, avatar)) {
      synced = true;
      break;
    }
  }

  if (!synced) {
    captureFlowFailure({
      flow: 'profile_update',
      step: 'background_sync',
      message: 'pollUntilSynced exhausted retries without sync',
      level: 'warning',
    });
  }

  return latest;
}

/**
 * Polls the same unfiltered mentor-pool query MentorPoolWithData renders
 * (`search_pattern: '', limit: PAGE_LIMIT`) until this user no longer
 * appears in it. Called before `revalidatePath('/mentor-pool')` on account
 * deletion so the fresh SSR fetch that revalidation triggers doesn't
 * re-cache a stale result.
 *
 * Deliberately does NOT use `fetchUserById` (`/v1/mentors/{id}/profile`) as
 * a proxy: that endpoint reads the primary DB, which the delete call updates
 * synchronously, while `/v1/mentors` (the list mentor-pool actually renders
 * from) is backed by Elasticsearch, updated asynchronously off an SQS queue.
 * The DB can already 404 while the search index still returns the deleted
 * mentor — polling the DB-backed endpoint would falsely report "caught up".
 *
 * Never throws. Returns false (without blocking further than the retry
 * budget) if the search index hasn't caught up in time — callers should
 * proceed with revalidation regardless so the user isn't stuck waiting
 * indefinitely.
 */
export async function pollUntilUserDeleted(
  userId: number,
  maxRetries = 6,
  intervalMs = 2000
): Promise<boolean> {
  if (!userId || Number.isNaN(userId)) return true;

  for (let i = 0; i < maxRetries; i++) {
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    try {
      const mentors = await fetchMentors({
        search_pattern: '',
        limit: PAGE_LIMIT,
        cursor: '',
      });
      if (!mentors.some((mentor) => mentor.user_id === userId)) return true;
    } catch {
      // Inconclusive — keep retrying within budget.
    }
  }

  captureFlowFailure({
    flow: 'delete_account',
    step: 'poll_deletion_sync',
    message: 'pollUntilUserDeleted exhausted retries without confirmation',
    level: 'warning',
  });
  return false;
}

/**
 * Polls the same unfiltered mentor-pool query MentorPoolWithData renders
 * until this user's card reflects the just-saved name and avatar (or, for a
 * user newly becoming a mentor, until the card appears at all). Only
 * meaningful for mentors — callers should skip this for mentee saves, since
 * those never appear in the listing.
 *
 * Same rationale as `pollUntilUserDeleted`: `/v1/mentors` is Elasticsearch-
 * backed and updated asynchronously off an SQS queue, so an immediate
 * `revalidatePath('/mentor-pool')` after the (synchronous, DB-backed)
 * profile write can re-cache a still-stale card. Intended for background
 * (non-blocking) use after the initial save completes, so it doesn't delay
 * navigation the way blocking on this before the first `revalidateProfilePath`
 * call would.
 *
 * Never throws. Returns false if the search index hasn't caught up within
 * the retry budget — callers should proceed with revalidation regardless.
 */
export async function pollUntilMentorPoolSynced(
  userId: number,
  name: string,
  avatar: string,
  maxRetries = 6,
  intervalMs = 2000
): Promise<boolean> {
  if (!userId || Number.isNaN(userId)) return true;

  for (let i = 0; i < maxRetries; i++) {
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    try {
      const mentors = await fetchMentors({
        search_pattern: '',
        limit: PAGE_LIMIT,
        cursor: '',
      });
      const card = mentors.find((mentor) => mentor.user_id === userId);
      // mapMentor appends `?cb=<updated_at>` to the avatar URL, so compare
      // by prefix rather than exact equality.
      const avatarSynced =
        !avatar ||
        (typeof card?.avatar === 'string' && card.avatar.startsWith(avatar));
      if (card && card.name === name && avatarSynced) return true;
    } catch {
      // Inconclusive — keep retrying within budget.
    }
  }

  captureFlowFailure({
    flow: 'profile_update',
    step: 'poll_mentor_pool_sync',
    message: 'pollUntilMentorPoolSynced exhausted retries without confirmation',
    level: 'warning',
  });
  return false;
}
