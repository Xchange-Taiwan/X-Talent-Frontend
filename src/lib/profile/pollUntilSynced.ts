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

// Deliberately not `@/app/mentor-pool/constants`'s PAGE_LIMIT — this is a
// `lib` module and must not depend on an `app` route's constants. It's
// also a different concern: that constant sizes the UI's unfiltered first
// page, while this bounds a *search_pattern-scoped* query, which only
// ever needs to be large enough to hold same-name collisions.
const MENTOR_POOL_POLL_LIMIT = 20;

/**
 * Repeatedly calls `check` (bounded by `maxRetries`/`intervalMs`) until it
 * returns true, or the budget is exhausted. Treats a thrown error from
 * `check` as inconclusive and keeps retrying. Never throws.
 */
async function pollUntil(
  check: () => Promise<boolean>,
  maxRetries: number,
  intervalMs: number
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    try {
      if (await check()) return true;
    } catch {
      // Inconclusive — keep retrying within budget.
    }
  }
  return false;
}

/**
 * Polls the mentor-pool search query until this user no longer appears in
 * it. Called before `revalidatePath('/mentor-pool')` on account deletion
 * so the fresh SSR fetch that revalidation triggers doesn't re-cache a
 * stale result.
 *
 * Deliberately does NOT use `fetchUserById` (`/v1/mentors/{id}/profile`) as
 * a proxy: that endpoint reads the primary DB, which the delete call updates
 * synchronously, while `/v1/mentors` (the list mentor-pool actually renders
 * from) is backed by Elasticsearch, updated asynchronously off an SQS queue.
 * The DB can already 404 while the search index still returns the deleted
 * mentor — polling the DB-backed endpoint would falsely report "caught up".
 *
 * `name`, when available, scopes the query via `search_pattern` so the
 * check isn't limited to whatever happens to sort onto the unfiltered
 * listing's first page. Without it, falls back to an unfiltered query,
 * which can only prove absence from that page, not the full listing.
 *
 * Never throws. Returns false (without blocking further than the retry
 * budget) if the search index hasn't caught up in time — callers should
 * proceed with revalidation regardless so the user isn't stuck waiting
 * indefinitely.
 */
export async function pollUntilUserDeleted(
  userId: number,
  name?: string,
  maxRetries = 6,
  intervalMs = 2000
): Promise<boolean> {
  if (!userId || Number.isNaN(userId)) return true;

  const confirmed = await pollUntil(
    async () => {
      const mentors = await fetchMentors({
        search_pattern: name ?? '',
        limit: MENTOR_POOL_POLL_LIMIT,
        cursor: '',
      });
      return !mentors.some((mentor) => mentor.user_id === userId);
    },
    maxRetries,
    intervalMs
  );

  if (!confirmed) {
    captureFlowFailure({
      flow: 'delete_account',
      step: 'poll_deletion_sync',
      message: 'pollUntilUserDeleted exhausted retries without confirmation',
      level: 'warning',
    });
  }

  return confirmed;
}

/**
 * Polls the mentor-pool search query (scoped to `name` via
 * `search_pattern`, so it isn't limited to the unfiltered listing's first
 * page) until this user's card reflects the just-saved name and avatar
 * (or, for a user newly becoming a mentor, until the card appears at
 * all). Only meaningful for mentors — callers should skip this for
 * mentee saves, since those never appear in the listing.
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

  const confirmed = await pollUntil(
    async () => {
      const mentors = await fetchMentors({
        search_pattern: name,
        limit: MENTOR_POOL_POLL_LIMIT,
        cursor: '',
      });
      const card = mentors.find((mentor) => mentor.user_id === userId);
      // mapMentor appends `?cb=<updated_at>` to the avatar URL, so compare
      // by prefix rather than exact equality.
      const avatarSynced =
        !avatar ||
        (typeof card?.avatar === 'string' && card.avatar.startsWith(avatar));
      return Boolean(card && card.name === name && avatarSynced);
    },
    maxRetries,
    intervalMs
  );

  if (!confirmed) {
    captureFlowFailure({
      flow: 'profile_update',
      step: 'poll_mentor_pool_sync',
      message:
        'pollUntilMentorPoolSynced exhausted retries without confirmation',
      level: 'warning',
    });
  }

  return confirmed;
}
