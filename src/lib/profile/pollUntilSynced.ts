import { ProfileFormValues } from '@/components/profile/edit/profileSchema';
import { fetchUser, UserDTO } from '@/services/profile/user';

function isProfileSynced(
  values: ProfileFormValues,
  latest: UserDTO,
  avatar: string
): boolean {
  if (latest.name !== values.name) return false;
  if ((latest.location ?? '') !== (values.location ?? '')) return false;
  if ((latest.personal_statement ?? '') !== (values.statement ?? ''))
    return false;
  if ((latest.about ?? '') !== (values.about ?? '')) return false;
  if ((latest.years_of_experience ?? '') !== (values.years_of_experience ?? ''))
    return false;
  if ((latest.industry?.subject_group ?? '') !== (values.industry ?? ''))
    return false;
  if (avatar && latest.avatar !== avatar) return false;
  return true;
}

export async function pollUntilSynced(
  values: ProfileFormValues,
  avatar: string,
  maxRetries = 12,
  intervalMs = 5000
): Promise<UserDTO | null> {
  let latest = await fetchUser('zh_TW');
  for (
    let i = 1;
    i < maxRetries && !(latest && isProfileSynced(values, latest, avatar));
    i++
  ) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    latest = await fetchUser('zh_TW');
  }
  return latest;
}
