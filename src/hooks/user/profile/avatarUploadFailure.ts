import type { UseFormReturn } from 'react-hook-form';

import { LoggedError } from '@/lib/profile/saveProfile';
import type { ProfileFormValues } from '@/schemas/profileSchema';

export const AVATAR_UPLOAD_FAILED_MESSAGE = '頭像上傳失敗，請重新選擇。';
export const AVATAR_FILE_FIELD_ID = 'avatarFile';

/** True when `commitProfileMutation` failed at its S3 avatar upload step. */
export function isAvatarUploadFailure(err: unknown): err is LoggedError {
  return err instanceof LoggedError && err.step === 'avatar_upload';
}

/**
 * Single feedback path for an avatar upload failure shared by the onboarding
 * and profile-edit forms: mark the `avatarFile` field invalid and scroll the
 * `#avatarFile` section into view instead of showing a generic toast.
 */
export function reportAvatarUploadFailure(
  form: Pick<UseFormReturn<ProfileFormValues>, 'setError'>,
  scrollToField: (fieldId: string) => void
): void {
  form.setError('avatarFile', {
    type: 'custom',
    message: AVATAR_UPLOAD_FAILED_MESSAGE,
  });
  scrollToField(AVATAR_FILE_FIELD_ID);
}
