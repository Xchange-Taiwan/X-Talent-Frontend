'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useUnsavedChangesPrompt } from '@/hooks/useUnsavedChangesPrompt';
import { mapVoToFormValues } from '@/lib/profile/profileSaveAdapter';
import type { ProfileFormValues } from '@/schemas/profileSchema';

import { useBackgroundAvatarUpload } from './useBackgroundAvatarUpload';
import { useEditProfileData } from './useEditProfileData';
import { useEditProfileForm } from './useEditProfileForm';
import { useFormErrorScroll } from './useFormErrorScroll';
import { useProfileSubmit } from './useProfileSubmit';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface UseProfileEditorSessionOptions {
  pageUserId: string;
  isAuthorized: boolean;
  isMentorOnboarding: boolean;
}

/**
 * Cohesive profile editor session module owning:
 * 1. One-shot DTO-to-form hydration per `pageUserId` (ignoring background SWR
 *    revalidations once hydrated so dirty form inputs are never clobbered).
 * 2. Background S3 avatar upload, consumption on save, and automatic rollback
 *    on cancel or unconsumed unmount/navigation.
 * 3. Section-level validation (`work_experiences` and `educations`) integrated
 *    directly into the submit handler with automatic error scrolling.
 */
export function useProfileEditorSession({
  pageUserId,
  isAuthorized,
  isMentorOnboarding,
}: UseProfileEditorSessionOptions) {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();

  const [isHydrating, setIsHydrating] = useState(true);
  const [prevPageUserId, setPrevPageUserId] = useState(pageUserId);
  const hydratedPageUserIdRef = useRef<string | null>(null);

  if (pageUserId !== prevPageUserId) {
    setPrevPageUserId(pageUserId);
    setIsHydrating(true);
  }

  const { userDto, isMentor, isError } = useEditProfileData({
    userId: Number(pageUserId),
    isAuthorized,
  });

  const isMentorRole = isMentor || isMentorOnboarding;
  const { form } = useEditProfileForm(isMentorRole);
  const { formRef, onError, scrollToField } =
    useFormErrorScroll<ProfileFormValues>();

  useIsomorphicLayoutEffect(() => {
    if (!isAuthorized || !userDto) return;
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

  const avatarUpload = useBackgroundAvatarUpload();

  const handleAvatarFileChange = useCallback(
    (file: File) => {
      avatarUpload.kickOff(file, form.getValues('avatar'));
    },
    [avatarUpload, form]
  );

  const { onSubmit, isSaving } = useProfileSubmit({
    pageUserId,
    isMentorOnboarding,
    session,
    updateSession,
    consumeAvatarUpload: avatarUpload.consume,
    currentDto: userDto,
  });

  const jobSectionErrorRef = useRef(false);
  const educationSectionErrorRef = useRef(false);

  const setJobSectionError = useCallback((hasError: boolean) => {
    jobSectionErrorRef.current = hasError;
  }, []);

  const setEducationSectionError = useCallback((hasError: boolean) => {
    educationSectionErrorRef.current = hasError;
  }, []);

  const handleFormSubmit = useCallback(
    (e?: React.BaseSyntheticEvent) =>
      form.handleSubmit((values) => {
        if (jobSectionErrorRef.current || educationSectionErrorRef.current) {
          scrollToField(
            jobSectionErrorRef.current ? 'work_experiences' : 'educations'
          );
          return;
        }
        return onSubmit(values, form.formState.dirtyFields);
      }, onError)(e),
    [form, onSubmit, onError, scrollToField]
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
    setJobSectionError,
    setEducationSectionError,
    handleGoToPrev,
    isPromptOpen: unsaved.isPromptOpen,
    cancelLeave: unsaved.cancelLeave,
    confirmLeave: handleConfirmLeave,
  };
}
