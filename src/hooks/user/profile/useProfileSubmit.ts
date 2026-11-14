'use client';
import { useRouter } from 'next/navigation';
import { Session } from 'next-auth';
import { useCallback, useMemo } from 'react';

import { revalidateProfilePath } from '@/app/profile/[pageUserId]/actions';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { type ProfileDirtyFields } from '@/lib/profile/profileSaveAdapter';
import {
  LoggedError,
  type ProfileSavePort,
  saveProfile,
} from '@/lib/profile/saveProfile';
import { ProfileFormValues } from '@/schemas/profileSchema';
import type { IndustryOption } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

export type { ProfileDirtyFields };

interface Options {
  pageUserId: string;
  isMentorOnboarding: boolean;
  session: Session | null;
  updateSession: (data: unknown) => Promise<Session | null>;
  consumeAvatarUpload?: (file: File | undefined) => Promise<string | undefined>;
  currentDto?: MentorProfileVO | null;
  industryCatalog?: readonly IndustryOption[];
}

export function useProfileSubmit({
  pageUserId,
  isMentorOnboarding,
  session,
  updateSession,
  consumeAvatarUpload,
  currentDto,
  industryCatalog,
}: Options) {
  const { push } = useRouter();

  const port = useMemo<ProfileSavePort>(
    () => ({
      updateSession,
      navigate: push,
      revalidateProfilePath,
      ...(consumeAvatarUpload
        ? { uploadAvatar: (file: File) => consumeAvatarUpload(file) }
        : {}),
    }),
    [updateSession, push, consumeAvatarUpload]
  );

  const { run, isPending: isSaving } = useAsyncAction({
    captureFailure: {
      flow: 'profile_update',
      step: 'update_profile',
    },
    toastOnError: {
      description: '儲存失敗，請稍後再試',
    },
    throwError: false,
    resetPendingOnSuccess: false,
    shouldSkipLogging: (err) => err instanceof LoggedError,
  });

  const onSubmit = useCallback(
    async (
      values: ProfileFormValues,
      dirtyFields?: ProfileDirtyFields
    ): Promise<MentorProfileVO | undefined> => {
      return await run(() =>
        saveProfile(
          values,
          {
            pageUserId,
            isMentorOnboarding,
            session,
            dirtyFields,
            currentDto,
            industryCatalog,
          },
          port
        )
      );
    },
    [
      run,
      pageUserId,
      isMentorOnboarding,
      session,
      currentDto,
      industryCatalog,
      port,
    ]
  );

  return { onSubmit, isSaving };
}
