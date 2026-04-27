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
