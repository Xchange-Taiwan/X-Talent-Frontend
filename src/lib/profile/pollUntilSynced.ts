import { ProfileFormValues } from '@/components/profile/edit/profileSchema';
import { captureFlowFailure } from '@/lib/monitoring';
import { fetchUser, MentorProfileVO } from '@/services/profile/user';

function isProfileSynced(
  values: ProfileFormValues,
  latest: MentorProfileVO,
  avatar: string
): boolean {
  if (latest.name !== values.name) return false;
  if ((latest.location ?? '') !== (values.location ?? '')) return false;
  if ((latest.personal_statement ?? '') !== (values.statement ?? ''))
    return false;
  if ((latest.about ?? '') !== (values.about ?? '')) return false;
  if ((latest.years_of_experience ?? '') !== (values.years_of_experience ?? ''))
    return false;
  const industryFirst = Array.isArray(values.industry)
    ? (values.industry[0] ?? '')
    : (values.industry ?? '');
  if ((latest.industry?.subject_group ?? '') !== industryFirst) return false;
  if (avatar && latest.avatar !== avatar) return false;
  return true;
}

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
  values: ProfileFormValues,
  avatar: string,
  timeoutMs = 800
): Promise<MentorProfileVO | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });

  const fetchPromise = fetchUser('zh_TW')
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
 * Polls fetchUser until the backend reflects the submitted values, or the
 * retry budget is exhausted. Designed for fire-and-forget background use:
 * never throws, and reports a Sentry breadcrumb if max retries elapse
 * without sync.
 */
export async function pollUntilSynced(
  values: ProfileFormValues,
  avatar: string,
  maxRetries = 12,
  intervalMs = 5000
): Promise<MentorProfileVO | null> {
  let latest: MentorProfileVO | null = null;
  let synced = false;

  for (let i = 0; i < maxRetries; i++) {
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    try {
      latest = await fetchUser('zh_TW');
    } catch {
      latest = null;
      continue;
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
    });
  }

  return latest;
}
