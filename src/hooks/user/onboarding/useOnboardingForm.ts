'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';

import { revalidateProfilePath } from '@/app/profile/[pageUserId]/actions';
import { useToast } from '@/components/ui/use-toast';
import { useBackgroundAvatarUpload } from '@/hooks/user/profile/useBackgroundAvatarUpload';
import { trackEvent } from '@/lib/analytics';
import {
  clampOnboardingName,
  sanitizePrefillAvatarUrl,
} from '@/lib/auth/oauthOutcome';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  commitProfileMutation,
  type ProfileSavePort,
} from '@/lib/profile/saveProfile';
import { formSchema, type OnboardingFormValues } from '@/schemas/onboarding';
import { fetchUserById } from '@/services/profile/user';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';

export type OnboardingStepNumber = 1 | 2 | 3 | 4 | 5;

export const STEP_FIELDS: Record<
  OnboardingStepNumber,
  Array<keyof OnboardingFormValues>
> = {
  1: ['name', 'avatar', 'avatarFile', 'language'],
  2: ['location', 'years_of_experience', 'industry'],
  3: ['want_position'],
  4: ['want_skill'],
  5: ['want_topic'],
};

interface Options {
  industries: TagCatalogsByBucket['industry'];
  port?: Partial<ProfileSavePort>;
}

export interface UseOnboardingFormResult {
  currentStep: OnboardingStepNumber;
  isSubmitting: boolean;
  form: UseFormReturn<OnboardingFormValues>;
  advanceStep: () => Promise<boolean>;
  submitOnboarding: () => Promise<void>;
  handleGoToPrev: () => void;
}

export function useOnboardingForm({
  industries,
  port: portOverrides,
}: Options): UseOnboardingFormResult {
  const router = useRouter();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<OnboardingStepNumber>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: session, status, update: updateSession } = useSession();
  const latestSessionRef = useRef(session);
  latestSessionRef.current = session;
  const latestUpdateSessionRef = useRef(updateSession);
  latestUpdateSessionRef.current = updateSession;

  const isSubmittingRef = useRef(false);

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

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      avatarFile: undefined,
      avatar: '',
      language: 'zh_TW',
      location: 'TWN',
      years_of_experience: '',
      industry: '',
      want_position: [],
      want_skill: [],
      want_topic: [],
    },
  });

  // Subscribe to RHF's Proxy-tracked dirtyFields so form.getFieldState(..., form.formState)
  // always reflects live user edits across steps and headless tests.
  void form.formState.dirtyFields;

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
      metadata: { step: currentStep },
    });
  }, [currentStep]);

  const watchedAvatarFile = form.watch('avatarFile');
  useEffect(() => {
    if (watchedAvatarFile) {
      form.clearErrors('avatarFile');
    }
  }, [watchedAvatarFile, form]);

  const advanceStep = useCallback(async (): Promise<boolean> => {
    if (currentStep >= 5) {
      return false;
    }
    const fields = STEP_FIELDS[currentStep];
    const isValid = await form.trigger(fields);
    if (!isValid) {
      return false;
    }

    if (currentStep === 1) {
      const avatarFile = form.getValues('avatarFile');
      if (avatarFile) {
        const currentAvatar = form.getValues('avatar') ?? '';
        const snapshotAvatarUrl = currentAvatar.startsWith(
          'https://lh3.googleusercontent.com/'
        )
          ? ''
          : currentAvatar;
        avatarUpload.kickOff(avatarFile, snapshotAvatarUrl);
      } else {
        avatarUpload.abort();
      }
      trackEvent({
        name: 'onboarding_step_1_completed',
        feature: 'onboarding',
      });
    } else {
      trackEvent({
        name: `onboarding_step_${currentStep}_completed`,
        feature: 'onboarding',
      });
    }

    setCurrentStep((prev) => Math.min(5, prev + 1) as OnboardingStepNumber);
    return true;
  }, [avatarUpload, currentStep, form]);

  const savePort = useMemo<ProfileSavePort>(
    () => ({
      updateSession: (data: unknown) => latestUpdateSessionRef.current(data),
      navigate: (href: string) => router.push(href),
      revalidateProfilePath,
      ...portOverrides,
    }),
    [portOverrides, router]
  );

  const submitOnboarding = useCallback(async (): Promise<void> => {
    if (isSubmittingRef.current) {
      return;
    }
    backfillControllerRef.current?.abort();
    isSubmittingRef.current = true;

    try {
      const isValid = await form.trigger();
      const rawValues = form.getValues();
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
        const orderedSteps: OnboardingStepNumber[] = [1, 2, 3, 4, 5];
        const earliestStep = orderedSteps.find((step) =>
          STEP_FIELDS[step].some((field) => errorFieldNames.has(field))
        );
        if (earliestStep && earliestStep !== currentStep) {
          setCurrentStep(earliestStep);
        }
        return;
      }

      const values: OnboardingFormValues = { ...parsed.data };
      setIsSubmitting(true);

      if (backfillUpdatePromiseRef.current) {
        await backfillUpdatePromiseRef.current.catch(() => undefined);
        // Yield one macrotask so NextAuth SessionProvider flushes setLoading(false)
        // and refreshes latestUpdateSessionRef before commitProfileMutation updates session.
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 0);
        });
      }

      if (values.avatarFile) {
        try {
          const uploadedUrl = await avatarUpload.consume(values.avatarFile);
          values.avatar = uploadedUrl ?? values.avatar;
          values.avatarFile = undefined;
          form.setValue('avatar', values.avatar);
          form.setValue('avatarFile', undefined);
        } catch (err) {
          captureFlowFailure({
            flow: 'onboarding_submit',
            step: 'avatar_upload',
            message:
              err instanceof Error ? err.message : 'Avatar upload failed',
            level: 'warning',
          });
          avatarUpload.abort();
          form.setError('avatarFile', {
            type: 'custom',
            message: '頭像上傳失敗，請重新選擇。',
          });
          setCurrentStep(1);
          return;
        }
      }

      const activeSession = latestSessionRef.current;
      await commitProfileMutation(
        {
          mode: 'mentee-onboarding',
          values,
        },
        {
          pageUserId: activeSession?.user?.id
            ? String(activeSession.user.id)
            : undefined,
          session: activeSession,
          industryCatalog: industries,
        },
        savePort
      );
    } catch {
      toast({
        variant: 'destructive',
        description: '儲存失敗，請稍後再試。',
        duration: 5000,
      });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [avatarUpload, currentStep, form, industries, savePort, toast]);

  const handleGoToPrev = useCallback(() => {
    setCurrentStep((s) => Math.max(1, s - 1) as OnboardingStepNumber);
  }, []);

  return {
    currentStep,
    isSubmitting,
    form,
    advanceStep,
    submitOnboarding,
    handleGoToPrev,
  };
}
