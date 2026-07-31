'use client';
import { useRouter } from 'next/navigation';
import { Session } from 'next-auth';
import { useCallback } from 'react';

import { revalidateProfilePath } from '@/app/profile/[pageUserId]/actions';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import {
  clearUserDataCache,
  primeUserDataCache,
} from '@/hooks/user/user-data/useUserData';
import { type ProfileDirtyFields } from '@/lib/profile/profileSaveAdapter';
import { LoggedError, saveProfile } from '@/lib/profile/saveProfile';
import { ProfileFormValues } from '@/schemas/profileSchema';

export type { ProfileDirtyFields };

interface Options {
  pageUserId: string;
  isMentorOnboarding: boolean;
  session: Session | null;
  updateSession: (data: unknown) => Promise<Session | null>;
  consumeAvatarUpload?: (file: File | undefined) => Promise<string | undefined>;
}

export function useProfileSubmit({
  pageUserId,
  isMentorOnboarding,
  session,
  updateSession,
  consumeAvatarUpload,
}: Options) {
  const router = useRouter();

  // 概念驗證 (PoC) 呼叫端：此處整合並呼叫統一管理非同步生命週期的 useAsyncAction Hook
  // 作為 X-Tracker #436 基礎建設的一部分，用於收斂載入狀態、防重複連擊與 Sentry 錯誤上報
  const { run, isPending: isSaving } = useAsyncAction({
    flow: 'profile_update',
    step: 'update_profile',
    errorMessage: '儲存失敗，請稍後再試',
    throwError: false,
    resetPendingOnSuccess: false, // 成功後保持 isSaving 為 true 以模擬轉址中的 UI
    shouldSkipLogging: (err) => err instanceof LoggedError,
  });

  const onSubmit = useCallback(
    async (values: ProfileFormValues, dirtyFields?: ProfileDirtyFields) => {
      await run(() =>
        saveProfile(values, {
          pageUserId,
          isMentorOnboarding,
          session,
          dirtyFields,
          consumeAvatarUpload,
          updateSession,
          navigate: router.push,
          revalidateProfilePath,
          clearUserDataCache,
          primeUserDataCache,
        })
      );
    },
    [
      run,
      pageUserId,
      isMentorOnboarding,
      session,
      consumeAvatarUpload,
      updateSession,
      router.push,
    ]
  );

  return { onSubmit, isSaving };
}
