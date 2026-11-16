'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';

import { revalidateProfilePath } from '@/app/profile/[pageUserId]/actions';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useUserProfileDto } from '@/hooks/user/user-data/useUserProfileDto';
import { useUnsavedChangesPrompt } from '@/hooks/useUnsavedChangesPrompt';
import { getSafeErrorMessage } from '@/lib/errorUtils';
import {
  mapVoToFormValues,
  type ProfileDirtyFields,
} from '@/lib/profile/profileSaveAdapter';
import {
  commitProfileMutation,
  LoggedError,
  type ProfileSavePort,
} from '@/lib/profile/saveProfile';
import {
  createProfileFormSchema,
  defaultValues,
  type ProfileFormInput,
  type ProfileFormValues,
} from '@/schemas/profileSchema';
import type { IndustryOption } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

import { useBackgroundAvatarUpload } from './useBackgroundAvatarUpload';
import { useFormErrorScroll } from './useFormErrorScroll';

export type ProfileFormContext = UseFormReturn<
  ProfileFormInput,
  unknown,
  ProfileFormValues
>;

export type { ProfileDirtyFields };

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface UseProfileEditorSessionOptions {
  pageUserId: string;
  isAuthorized: boolean;
  isMentorOnboarding: boolean;
  industryCatalog?: readonly IndustryOption[];
  port?: Partial<ProfileSavePort>;
}

export function useProfileEditorSession({
  pageUserId,
  isAuthorized,
  isMentorOnboarding,
  industryCatalog,
  port: portOverrides,
}: UseProfileEditorSessionOptions) {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();

  const numericPageUserId = Number(pageUserId);
  const resolvedPageUserIdNum = Number.isFinite(numericPageUserId)
    ? numericPageUserId
    : undefined;

  const [isHydrating, setIsHydrating] = useState(true);
  const [prevPageUserId, setPrevPageUserId] = useState(pageUserId);
  const hydratedPageUserIdRef = useRef<string | null>(null);

  if (pageUserId !== prevPageUserId) {
    setPrevPageUserId(pageUserId);
    setIsHydrating(true);
  }

  const { userDto, error: dtoError } = useUserProfileDto(
    numericPageUserId,
    'zh_TW'
  );

  useEffect(() => {
    if (!dtoError) return;
    console.error('Failed to fetch user data:', getSafeErrorMessage(dtoError));
  }, [dtoError]);

  const isMentor = userDto ? Boolean(userDto.is_mentor) : false;
  const isError = Boolean(dtoError) && !userDto;
  const isMentorRole = isMentor || isMentorOnboarding;

  const resolver = useMemo(
    () =>
      zodResolver<ProfileFormInput, unknown, ProfileFormValues>(
        createProfileFormSchema(isMentorRole)
      ),
    [isMentorRole]
  );

  const form = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver,
    defaultValues,
  });

  const { formRef, onError } = useFormErrorScroll<ProfileFormValues>();

  useIsomorphicLayoutEffect(() => {
    if (!isAuthorized || !userDto) return;
    if (
      userDto.user_id !== undefined &&
      String(userDto.user_id) !== pageUserId
    ) {
      return;
    }
    if (hydratedPageUserIdRef.current === pageUserId && !isHydrating) {
      return;
    }

    const formValues = mapVoToFormValues(userDto, isMentorOnboarding);
    form.reset(formValues);
    hydratedPageUserIdRef.current = pageUserId;
    setIsHydrating(false);
  }, [
    userDto,
    isAuthorized,
    isMentorOnboarding,
    pageUserId,
    form,
    isHydrating,
  ]);

  const sessionUserIdNum = session?.user?.id
    ? Number(session.user.id)
    : undefined;
  const effectiveUploadUserId = isAuthorized
    ? (resolvedPageUserIdNum ?? sessionUserIdNum)
    : undefined;
  const avatarUpload = useBackgroundAvatarUpload(effectiveUploadUserId);

  const handleAvatarFileChange = useCallback(
    (file: File) => {
      avatarUpload.kickOff(file, form.getValues('avatar'));
    },
    [avatarUpload, form]
  );

  const savePort = useMemo<ProfileSavePort>(
    () => ({
      updateSession,
      navigate: (href: string) => router.push(href),
      revalidateProfilePath,
      uploadAvatar: (file: File) => avatarUpload.consume(file),
      ...portOverrides,
    }),
    [avatarUpload, portOverrides, router, updateSession]
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
        commitProfileMutation(
          {
            mode: isMentorOnboarding ? 'mentor-onboarding' : 'edit',
            values,
            dirtyFields,
            currentDto: userDto,
          },
          {
            pageUserId,
            session,
            industryCatalog,
          },
          savePort
        )
      );
    },
    [
      industryCatalog,
      isMentorOnboarding,
      pageUserId,
      run,
      savePort,
      session,
      userDto,
    ]
  );

  const handleFormSubmit = useCallback(
    (e?: React.BaseSyntheticEvent) =>
      form.handleSubmit(
        (values) => onSubmit(values, form.formState.dirtyFields),
        onError
      )(e),
    [form, onSubmit, onError]
  );

  const unsaved = useUnsavedChangesPrompt(form.formState.isDirty && !isSaving);

  const handleGoToPrev = useCallback(() => {
    unsaved.guardNavigate(() => router.push(`/profile/${pageUserId}`));
  }, [unsaved, router, pageUserId]);

  const handleConfirmLeave = useCallback(() => {
    void avatarUpload.rollback();
    unsaved.confirmLeave();
  }, [avatarUpload, unsaved]);

  return {
    form,
    formRef,
    userDto,
    isMentorRole,
    isError,
    isHydrating,
    isSaving,
    handleAvatarFileChange,
    handleFormSubmit,
    handleGoToPrev,
    isPromptOpen: unsaved.isPromptOpen,
    cancelLeave: unsaved.cancelLeave,
    confirmLeave: handleConfirmLeave,
  };
}
