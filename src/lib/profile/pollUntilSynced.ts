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
 * Known false-positive window (accepted, not fixed here): "no match"
 * isn't proof of deletion — it's also what a missing/stale `name` looks
 * like (a session whose JWT predates a since-changed display name, or a
 * caller with no name at all falling back to the unfiltered query, which
 * can miss a real match sitting past `MENTOR_POOL_POLL_LIMIT`). Either
 * can make this return `true` before the index has actually caught up.
 * A fully airtight check needs a backend endpoint that confirms deletion
 * by id directly against the search index, which doesn't exist yet — the
 * caller's `revalidatePath('/mentor-pool')` re-caching a stale card in
 * that window is bounded by the same 24h ISR TTL (`mentors.server.ts`)
 * that already backstops every other gap in this poll, not a new,
 * unbounded exposure.
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

// Every field the mentor card (`MentorCardProps` /
// `mentor-card-list/index.tsx`) actually renders. Checking only a subset
// (e.g. name + avatar) would report "synced" the instant a save that left
// those two untouched hits the search index, even though other rendered
// fields (job title, company, about, topics) are still stale on it.
export interface MentorCardFields {
  name: string;
  jobTitle: string;
  company: string;
  about: string;
  yearsOfExperience: string;
  haveTopic: string[];
  avatar: string;
}

function sameTopics(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedB = [...b].sort();
  return [...a].sort().every((topic, i) => topic === sortedB[i]);
}

/**
 * Polls the mentor-pool search query (scoped to `fields.name` via
 * `search_pattern`, so it isn't limited to the unfiltered listing's first
 * page) until this user's card reflects every just-saved, card-visible
 * field (or, for a user newly becoming a mentor, until the card appears
 * at all). Only meaningful for mentors — callers should skip this for
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
  fields: MentorCardFields,
  maxRetries = 6,
  intervalMs = 2000
): Promise<boolean> {
  if (!userId || Number.isNaN(userId)) return true;

  const confirmed = await pollUntil(
    async () => {
      const mentors = await fetchMentors({
        search_pattern: fields.name,
        limit: MENTOR_POOL_POLL_LIMIT,
        cursor: '',
      });
      const card = mentors.find((mentor) => mentor.user_id === userId);
      if (!card) return false;

      // mapMentor appends `?cb=<updated_at>` to the avatar URL, so compare
      // by prefix rather than exact equality.
      const avatarSynced =
        !fields.avatar ||
        (typeof card.avatar === 'string' &&
          card.avatar.startsWith(fields.avatar));

      return (
        card.name === fields.name &&
        card.job_title === fields.jobTitle &&
        card.company === fields.company &&
        card.about === fields.about &&
        card.years_of_experience === fields.yearsOfExperience &&
        sameTopics(card.have_topic, fields.haveTopic) &&
        avatarSynced
      );
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
  revalidate: () => Promise<void>
): Promise<void> {
  if (!isMentorRelevant) return;
  await pollUntilMentorPoolSynced(userId, fields);
  await revalidate();
}

/**
 * Owns the "confirm the mentor-pool search index no longer lists the
 * deleted user, then purge the profile/mentor-pool caches" sequence for
 * account deletion. Mirrors `revalidateProfilePath`
 * (`src/app/profile/[pageUserId]/actions.ts`) but scoped to the caller's
 * own account rather than a `[pageUserId]` route param — see that
 * function's own doc comment for why deletion doesn't reuse it directly.
 *
 * `revalidatePaths` and `poll` are injected rather than imported directly
 * (mirrors `confirmProfileSynced`'s `revalidate` param): `revalidatePath`
 * is a Server Components/Server Actions-only API, and this module is
 * bundled into client code via `saveProfile.ts` — importing it at this
 * module's top level breaks that client bundle. The caller (`src/actions/
 * auth.ts`, already `'use server'`) owns calling `revalidatePath` itself.
 *
 * Each `revalidatePaths` entry is invoked independently-guarded so one
 * throwing doesn't skip the rest — the account is already deleted
 * server-side by the time this runs, so every cache-purge step must still
 * attempt to run regardless of an earlier one's outcome.
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
