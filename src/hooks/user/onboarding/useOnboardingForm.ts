'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';

import { revalidateProfilePath } from '@/app/profile/[pageUserId]/actions';
import { useToast } from '@/components/ui/use-toast';
import { useBackgroundAvatarUpload } from '@/hooks/user/profile/useBackgroundAvatarUpload';
import { useFormErrorScroll } from '@/hooks/user/profile/useFormErrorScroll';
import { trackEvent, trackFormValidationFailed } from '@/lib/analytics';
import {
  clampOnboardingName,
  sanitizePrefillAvatarUrl,
} from '@/lib/auth/sessionLifecycle';
import {
  DEFAULT_PRESET_AVATAR_CODE,
  isGooglePrefillAvatarUrl,
  toPresetAvatarCode,
} from '@/lib/avatar/avatarUrl';
import { getPendingFavoriteProfilePath } from '@/lib/favorites';
import { isDualTrackV2Enabled } from '@/lib/featureFlags';
import {
  type MenteeDirectionMap,
  writeStoredMenteeDirectionMap,
} from '@/lib/profile/menteeDirectionPreference';
import {
  type AvatarMutationSession,
  commitProfileMutation,
  LoggedError,
  type ProfileSavePort,
} from '@/lib/profile/saveProfile';
import { PROFILE_CARD_HREF } from '@/lib/routes';
import {
  formSchema,
  onboardingDefaultValues,
  type OnboardingFormInput,
  type OnboardingFormValues,
  type OnboardingRole,
} from '@/schemas/onboarding';
import {
  type ProfileFormValues,
  validateAvatarFile,
} from '@/schemas/profileSchema';
import { fetchUserById } from '@/services/profile/user';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';

export type OnboardingFormContext = UseFormReturn<
  OnboardingFormInput,
  unknown,
  OnboardingFormValues
>;

interface Options {
  industries: TagCatalogsByBucket['industry'];
  port?: Partial<ProfileSavePort>;
}

export interface UseOnboardingFormResult {
  isSubmitting: boolean;
  role: OnboardingRole;
  setRole: (next: OnboardingRole) => void;
  form: OnboardingFormContext;
  formRef: React.RefObject<HTMLFormElement>;
  directionMap: MenteeDirectionMap;
  setDirectionMap: (next: MenteeDirectionMap) => void;
  handleAvatarFileChange: (file: File) => void;
  handleSelectPresetAvatar: (presetUrlOrCode: string) => void;
  submitOnboarding: () => Promise<void>;
}

export function useOnboardingForm({
  industries,
  port: portOverrides,
}: Options): UseOnboardingFormResult {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [directionMap, setDirectionMap] = useState<MenteeDirectionMap>({});
  const { data: session, status, update: updateSession } = useSession();
  const latestSessionRef = useRef(session);
  latestSessionRef.current = session;
  const latestUpdateSessionRef = useRef(updateSession);
  latestUpdateSessionRef.current = updateSession;

  const isSubmittingRef = useRef(false);
  const presetSelectedRef = useRef(false);

  const backfilledProfileUserIdRef = useRef<number | null>(null);
  const backfillControllerRef = useRef<AbortController | null>(null);
  const backfillUpdatePromiseRef = useRef<Promise<unknown> | null>(null);
  const prefillTrackerRef = useRef<{
    userId: number | undefined;
    nameApplied: boolean;
    avatarApplied: boolean;
  }>({
    userId: undefined,
    nameApplied: false,
    avatarApplied: false,
  });

  const rawSessionUserId = session?.user?.id
    ? Number(session.user.id)
    : Number.NaN;
  const sessionUserId =
    Number.isFinite(rawSessionUserId) && rawSessionUserId > 0
      ? rawSessionUserId
      : undefined;
  if (prefillTrackerRef.current.userId !== sessionUserId) {
    prefillTrackerRef.current = {
      userId: sessionUserId,
      nameApplied: false,
      avatarApplied: false,
    };
  }

  const avatarUpload = useBackgroundAvatarUpload(sessionUserId);

  const form = useForm<OnboardingFormInput, unknown, OnboardingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: onboardingDefaultValues,
  });

  const { formRef, onError } = useFormErrorScroll<OnboardingFormValues>();

  void form.formState.dirtyFields;

  const rawWatchedRole = form.watch('role') ?? 'mentee';
  const watchedRole: OnboardingRole = isDualTrackV2Enabled()
    ? rawWatchedRole
    : 'mentee';

  const setRole = useCallback(
    (next: OnboardingRole) => {
      const resolvedNext: OnboardingRole = isDualTrackV2Enabled()
        ? next
        : 'mentee';
      if (form.getValues('role') === resolvedNext) return;
      form.setValue('role', resolvedNext, {
        shouldDirty: true,
        shouldValidate: false,
      });
      form.clearErrors();
    },
    [form]
  );

  const applyNonDirtyPrefill = useCallback(
    (
      rawName: string | null | undefined,
      rawAvatar: string | null | undefined
    ) => {
      if (isSubmittingRef.current) return;

      const tracker = prefillTrackerRef.current;
      const nameDirty = form.getFieldState('name', form.formState).isDirty;
      if (nameDirty) {
        tracker.nameApplied = true;
      } else if (!tracker.nameApplied) {
        const clampedName = clampOnboardingName(rawName);
        if (clampedName) {
          tracker.nameApplied = true;
          if (!form.getValues('name')) {
            form.setValue('name', clampedName, { shouldDirty: false });
          }
        }
      }

      const avatarDirty =
        form.getFieldState('avatar', form.formState).isDirty ||
        form.getFieldState('avatarFile', form.formState).isDirty ||
        Boolean(form.getValues('avatarFile'));
      if (avatarDirty) {
        tracker.avatarApplied = true;
      } else if (!tracker.avatarApplied) {
        const safeAvatar = sanitizePrefillAvatarUrl(rawAvatar);
        if (safeAvatar) {
          tracker.avatarApplied = true;
          if (!form.getValues('avatar')) {
            form.setValue('avatar', safeAvatar, { shouldDirty: false });
          }
        }
      }
    },
    [form]
  );

  const sessionUserName = session?.user?.name;
  const sessionUserAvatar = session?.user?.avatar;
  const hasSessionName = Boolean(sessionUserName?.trim());
  const hasSessionAvatar = Boolean(sessionUserAvatar?.trim());

  useEffect(() => {
    if (status !== 'authenticated') return;
    applyNonDirtyPrefill(sessionUserName, sessionUserAvatar);
  }, [applyNonDirtyPrefill, sessionUserAvatar, sessionUserName, status]);

  useEffect(() => {
    if (
      status !== 'authenticated' ||
      sessionUserId === undefined ||
      Number.isNaN(sessionUserId) ||
      (hasSessionName && hasSessionAvatar) ||
      backfilledProfileUserIdRef.current === sessionUserId
    ) {
      return;
    }

    const controller = new AbortController();
    backfillControllerRef.current = controller;
    const fetchProfileRecord =
      portOverrides?.fetchProfile ??
      ((userId: number, language = 'zh_TW') =>
        fetchUserById(userId, language, controller.signal, true));

    void Promise.resolve(fetchProfileRecord(sessionUserId, 'zh_TW'))
      .then((dto) => {
        if (controller.signal.aborted) return;
        backfilledProfileUserIdRef.current = sessionUserId;
        if (!dto || isSubmittingRef.current) return;

        const fetchedName = clampOnboardingName(dto.name) ?? '';
        const fetchedAvatar = sanitizePrefillAvatarUrl(dto.avatar) ?? '';

        applyNonDirtyPrefill(fetchedName, fetchedAvatar);

        const currentUser = latestSessionRef.current?.user;
        if (isSubmittingRef.current || currentUser?.onBoarding === true) {
          return;
        }
        const filledMissingName =
          !currentUser?.name?.trim() && Boolean(fetchedName);
        const filledMissingAvatar =
          !currentUser?.avatar?.trim() && Boolean(fetchedAvatar);
        if (filledMissingName || filledMissingAvatar) {
          const updatePromise = Promise.resolve(
            latestUpdateSessionRef.current({
              user: {
                ...(filledMissingName ? { name: fetchedName } : {}),
                ...(filledMissingAvatar ? { avatar: fetchedAvatar } : {}),
              },
            })
          ).finally(() => {
            if (backfillUpdatePromiseRef.current === updatePromise) {
              backfillUpdatePromiseRef.current = null;
            }
          });
          backfillUpdatePromiseRef.current = updatePromise;
          void updatePromise.catch(() => undefined);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          backfilledProfileUserIdRef.current = sessionUserId;
        }
      });

    return () => {
      controller.abort();
      if (backfillControllerRef.current === controller) {
        backfillControllerRef.current = null;
      }
    };
  }, [
    applyNonDirtyPrefill,
    hasSessionAvatar,
    hasSessionName,
    portOverrides?.fetchProfile,
    sessionUserId,
    status,
  ]);

  useEffect(() => {
    trackEvent({
      name: 'onboarding_step_viewed',
      feature: 'onboarding',
      metadata: { step: 1, role: watchedRole },
    });
  }, [watchedRole]);

  const watchedAvatarFile = form.watch('avatarFile');
  useEffect(() => {
    if (watchedAvatarFile) {
      form.clearErrors('avatarFile');
    }
  }, [watchedAvatarFile, form]);

  const handleAvatarFileChange = useCallback(
    (file: File) => {
      presetSelectedRef.current = false;
      form.setValue('avatarFile', file, {
        shouldDirty: true,
        shouldValidate: true,
      });
      if (validateAvatarFile(file) !== null) {
        return;
      }
      const currentAvatar = form.getValues('avatar') ?? '';
      const snapshotAvatarUrl = isGooglePrefillAvatarUrl(currentAvatar)
        ? ''
        : currentAvatar;
      avatarUpload.kickOff(file, snapshotAvatarUrl);
    },
    [avatarUpload, form]
  );

  const handleSelectPresetAvatar = useCallback(
    (presetUrlOrCode: string) => {
      presetSelectedRef.current = true;
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

  const avatarSession = useMemo<AvatarMutationSession>(
    () => ({
      resolve: (file: File | undefined) =>
        presetSelectedRef.current
          ? Promise.resolve(undefined)
          : avatarUpload.resolve(file),
      markCommitted: () => {
        avatarUpload.markCommitted();
      },
      abort: () => {
        avatarUpload.abort();
      },
      rollback: () => avatarUpload.rollback(),
    }),
    [avatarUpload]
  );

  const savePort = useMemo<ProfileSavePort>(
    () => ({
      updateSession: (data: unknown) => latestUpdateSessionRef.current(data),
      navigate: (href: string) => router.push(href),
      revalidateProfilePath,
      avatarSession: portOverrides?.uploadAvatar ? undefined : avatarSession,
      ...portOverrides,
    }),
    [avatarSession, portOverrides, router]
  );

  const submitOnboarding = useCallback(async (): Promise<void> => {
    if (isSubmittingRef.current) {
      return;
    }
    backfillControllerRef.current?.abort();
    isSubmittingRef.current = true;

    try {
      const isValid = await form.trigger();
      const rawValues = {
        ...form.getValues(),
        role: isDualTrackV2Enabled()
          ? (form.getValues('role') ?? 'mentee')
          : ('mentee' as const),
      };
      const parsed = formSchema.safeParse(rawValues);

      if (!isValid || !parsed.success) {
        const errorFieldNames = new Set<string>([
          ...Object.keys(form.formState.errors),
          ...(parsed.success
            ? []
            : parsed.error.issues
                .map((issue) => String(issue.path[0] ?? ''))
                .filter(Boolean)),
        ]);
        const activeRole = rawValues.role === 'mentor' ? 'mentor' : 'mentee';
        trackFormValidationFailed({
          feature: 'onboarding',
          formId:
            activeRole === 'mentor' ? 'mentor_onboarding' : 'mentee_onboarding',
          invalidKeys: Array.from(errorFieldNames),
          step: 1,
        });
        (
          onError as (
            errs: typeof form.formState.errors,
            ev?: React.BaseSyntheticEvent
          ) => void
        )(form.formState.errors);
        return;
      }

      const values: OnboardingFormValues = { ...parsed.data };
      setIsSubmitting(true);

      if (backfillUpdatePromiseRef.current) {
        await backfillUpdatePromiseRef.current.catch(() => undefined);
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 0);
        });
      }

      const activeSession = latestSessionRef.current;
      const resolvedPageUserId = activeSession?.user?.id
        ? String(activeSession.user.id)
        : undefined;
      const effectiveAvatarFile = presetSelectedRef.current
        ? undefined
        : values.avatarFile;

      if (values.role === 'mentor') {
        const mentorValues: ProfileFormValues = {
          is_mentor: true,
          onboarding: true,
          agreed_guidelines: true,
          avatar: values.avatar ?? '',
          avatarFile: effectiveAvatarFile,
          name: values.name,
          location: values.location,
          years_of_experience: values.years_of_experience,
          industry: values.industry ?? '',
          statement: '',
          about: values.about ?? '',
          have_topic: values.have_topic ?? [],
          have_skill: values.have_skill ?? [],
          want_position: [],
          want_skill: [],
          want_topic: [],
          work_experiences: values.work_experiences ?? [],
          educations: values.educations ?? [],
          links: values.links ?? onboardingDefaultValues.links!,
        };

        await commitProfileMutation(
          {
            mode: 'mentor-onboarding',
            values: mentorValues,
          },
          {
            pageUserId: resolvedPageUserId,
            session: activeSession,
            industryCatalog: industries,
            navigationTarget: '/profile/card',
          },
          savePort
        );
        return;
      }

      const resolvedMenteeAvatar = values.avatar?.trim()
        ? (toPresetAvatarCode(values.avatar) ?? values.avatar)
        : DEFAULT_PRESET_AVATAR_CODE;

      const menteeTarget = getPendingFavoriteProfilePath() ?? PROFILE_CARD_HREF;

      await commitProfileMutation(
        {
          mode: 'mentee-onboarding',
          values: {
            ...values,
            avatar: resolvedMenteeAvatar,
            avatarFile: effectiveAvatarFile,
          },
        },
        {
          pageUserId: resolvedPageUserId,
          session: activeSession,
          industryCatalog: industries,
          navigationTarget: menteeTarget,
        },
        savePort
      );

      if (resolvedPageUserId) {
        writeStoredMenteeDirectionMap(resolvedPageUserId, directionMap);
      }
    } catch (err) {
      if (err instanceof LoggedError && err.step === 'avatar_upload') {
        const avatarError = {
          type: 'custom',
          message: '頭像上傳失敗，請重新選擇。',
        } as const;
        form.setError('avatarFile', avatarError);
        (
          onError as (
            errs: typeof form.formState.errors,
            ev?: React.BaseSyntheticEvent
          ) => void
        )({
          ...form.formState.errors,
          avatarFile: avatarError,
        });
        return;
      }
      toast({
        variant: 'destructive',
        description: '儲存失敗，請稍後再試。',
        duration: 5000,
      });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [directionMap, form, industries, onError, savePort, toast]);

  return {
    isSubmitting,
    role: watchedRole,
    setRole,
    form,
    formRef,
    directionMap,
    setDirectionMap,
    handleAvatarFileChange,
    handleSelectPresetAvatar,
    submitOnboarding,
  };
}
