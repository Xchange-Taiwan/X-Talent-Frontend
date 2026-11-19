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
import { trackFormValidationFailed } from '@/lib/analytics';
import {
  DEFAULT_PRESET_AVATAR_CODE,
  toPresetAvatarCode,
} from '@/lib/avatar/avatarUrl';
import { getSafeErrorMessage } from '@/lib/errorUtils';
import { isDualTrackV2Enabled } from '@/lib/featureFlags';
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
  validateAvatarFile,
} from '@/schemas/profileSchema';
import type { IndustryOption } from '@/types/tagCatalog';
import type { MentorProfileVO } from '@/types/user';

import { useBackgroundAvatarUpload } from './useBackgroundAvatarUpload';
import { useFormErrorScroll } from './useFormErrorScroll';
import { useMenteeDirectionPreference } from './useMenteeDirectionPreference';

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
  const [cachedUserDto, setCachedUserDto] = useState<MentorProfileVO | null>(
    null
  );
  const [hasAvatarEdited, setHasAvatarEdited] = useState(false);
  const hydratedScopeRef = useRef<string | null>(null);
  const hasAvatarEditedRef = useRef(false);
  const hydrationScopeKey = `${pageUserId}:${isMentorOnboarding ? 'mentor-onboarding' : 'edit'}`;

  if (pageUserId !== prevPageUserId) {
    setPrevPageUserId(pageUserId);
    setCachedUserDto(null);
    setHasAvatarEdited(false);
    setIsHydrating(true);
  }

  const { userDto, error: dtoError } = useUserProfileDto(
    numericPageUserId,
    'zh_TW'
  );

  if (
    userDto &&
    userDto !== cachedUserDto &&
    (userDto.user_id === undefined || String(userDto.user_id) === pageUserId)
  ) {
    setCachedUserDto(userDto);
  }
  const effectiveUserDto = userDto ?? cachedUserDto;

  useEffect(() => {
    if (!dtoError) return;
    console.error('Failed to fetch user data:', getSafeErrorMessage(dtoError));
  }, [dtoError]);

  const isMentor = effectiveUserDto
    ? Boolean(effectiveUserDto.is_mentor)
    : false;
  const isError = Boolean(dtoError) && !effectiveUserDto;
  const isMentorRole = isMentor || isMentorOnboarding;

  const requireMenteePosition = !isDualTrackV2Enabled();
  const resolver = useMemo(
    () =>
      zodResolver<ProfileFormInput, unknown, ProfileFormValues>(
        createProfileFormSchema(isMentorRole, isMentorOnboarding, {
          requireMenteePosition,
        })
      ),
    [isMentorOnboarding, isMentorRole, requireMenteePosition]
  );

  const form = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver,
    defaultValues,
  });

  const { formRef, onError } = useFormErrorScroll<ProfileFormValues>();

  useEffect(() => {
    hasAvatarEditedRef.current = false;
  }, [hydrationScopeKey]);

  useIsomorphicLayoutEffect(() => {
    if (!isAuthorized || !userDto) return;
    if (
      userDto.user_id !== undefined &&
      String(userDto.user_id) !== pageUserId
    ) {
      return;
    }
    if (hydratedScopeRef.current === hydrationScopeKey && !isHydrating) {
      return;
    }

    const formValues = mapVoToFormValues(userDto, isMentorOnboarding);
    form.reset(formValues);
    hasAvatarEditedRef.current = false;
    setHasAvatarEdited(false);
    hydratedScopeRef.current = hydrationScopeKey;
    setIsHydrating(false);
  }, [
    userDto,
    isAuthorized,
    isMentorOnboarding,
    hydrationScopeKey,
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

  const presetSelectedRef = useRef(false);

  const handleAvatarFileChange = useCallback(
    (file: File) => {
      presetSelectedRef.current = false;
      hasAvatarEditedRef.current = true;
      setHasAvatarEdited(true);
      if (form.getValues('avatarFile') !== file) {
        form.setValue('avatarFile', file, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      if (validateAvatarFile(file) !== null) {
        return;
      }
      avatarUpload.kickOff(file, form.getValues('avatar'));
    },
    [avatarUpload, form]
  );

  const handleSelectPresetAvatar = useCallback(
    (presetUrlOrCode: string) => {
      presetSelectedRef.current = true;
      hasAvatarEditedRef.current = true;
      setHasAvatarEdited(true);
      void avatarUpload.rollback();
      const normalizedCode =
        toPresetAvatarCode(presetUrlOrCode) ??
        presetUrlOrCode ??
        DEFAULT_PRESET_AVATAR_CODE;
      form.setValue('avatarFile', undefined, {
        shouldDirty: false,
        shouldValidate: true,
      });
      form.setValue('avatar', normalizedCode, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [avatarUpload, form]
  );

  const {
    directionMap,
    setDirectionMap,
    isDirectionMapDirty,
    persistDirectionMap,
  } = useMenteeDirectionPreference(
    pageUserId,
    isMentorRole ? null : effectiveUserDto
  );

  const savePort = useMemo<ProfileSavePort>(
    () => ({
      updateSession,
      navigate: (href: string) => router.push(href),
      revalidateProfilePath,
      uploadAvatar: (file: File) =>
        presetSelectedRef.current
          ? Promise.resolve(undefined)
          : avatarUpload.consume(file),
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
      const effectiveDirtyFields =
        dirtyFields && hasAvatarEditedRef.current
          ? { ...dirtyFields, avatar: true }
          : dirtyFields;
      const saved = await run(() =>
        commitProfileMutation(
          {
            mode: isMentorOnboarding ? 'mentor-onboarding' : 'edit',
            values,
            dirtyFields: effectiveDirtyFields,
            currentDto: effectiveUserDto,
          },
          {
            pageUserId,
            session,
            industryCatalog,
          },
          savePort
        )
      );
      if (saved) {
        hasAvatarEditedRef.current = false;
        setHasAvatarEdited(false);
        if (!isMentorRole) {
          persistDirectionMap();
        }
      }
      return saved;
    },
    [
      effectiveUserDto,
      industryCatalog,
      isMentorOnboarding,
      isMentorRole,
      pageUserId,
      persistDirectionMap,
      run,
      savePort,
      session,
    ]
  );

  const handleFormInvalid = useCallback(
    (
      errors: Parameters<typeof onError>[0],
      event?: React.BaseSyntheticEvent
    ) => {
      trackFormValidationFailed({
        feature: 'profile',
        formId: isMentorOnboarding ? 'mentor_onboarding' : 'profile_edit',
        invalidKeys: Object.keys(errors),
      });
      (
        onError as (
          errs: Parameters<typeof onError>[0],
          ev?: React.BaseSyntheticEvent
        ) => void
      )(errors, event);
    },
    [isMentorOnboarding, onError]
  );

  const handleFormSubmit = useCallback(
    (e?: React.BaseSyntheticEvent) =>
      form.handleSubmit(
        (values) => onSubmit(values, form.formState.dirtyFields),
        handleFormInvalid
      )(e),
    [form, onSubmit, handleFormInvalid]
  );

  const hasUnsavedChanges =
    form.formState.isDirty ||
    hasAvatarEdited ||
    (!isMentorRole && isDirectionMapDirty);
  const unsaved = useUnsavedChangesPrompt(hasUnsavedChanges && !isSaving);

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
    userDto: effectiveUserDto,
    isMentorRole,
    isError,
    isHydrating,
    isSaving,
    directionMap,
    setDirectionMap,
    handleAvatarFileChange,
    handleSelectPresetAvatar,
    handleFormSubmit,
    handleGoToPrev,
    isPromptOpen: unsaved.isPromptOpen,
    cancelLeave: unsaved.cancelLeave,
    confirmLeave: handleConfirmLeave,
  };
}
