'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';

import { revalidateProfilePath } from '@/app/profile/[pageUserId]/actions';
import { useToast } from '@/components/ui/use-toast';
import { useBackgroundAvatarUpload } from '@/hooks/user/profile/useBackgroundAvatarUpload';
import { trackEvent, trackFormValidationFailed } from '@/lib/analytics';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  commitProfileMutation,
  type ProfileSavePort,
} from '@/lib/profile/saveProfile';
import { formSchema, type OnboardingFormValues } from '@/schemas/onboarding';
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
  const hasHydratedSessionRef = useRef(false);

  const sessionUserId = session?.user?.id ? Number(session.user.id) : undefined;
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

  useEffect(() => {
    if (status === 'loading' || hasHydratedSessionRef.current) return;
    hasHydratedSessionRef.current = true;
    const currentValues = form.getValues();
    form.reset({
      ...currentValues,
      name: currentValues.name || session?.user?.name || '',
      avatar: currentValues.avatar || session?.user?.avatar || '',
    });
  }, [session?.user?.name, session?.user?.avatar, status, form]);

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
      const parsedStep = formSchema.safeParse(form.getValues());
      const schemaInvalidSet = new Set<string>(
        parsedStep.success
          ? []
          : parsedStep.error.issues
              .map((issue) => String(issue.path[0] ?? ''))
              .filter(Boolean)
      );
      const stepErrorKeys = fields
        .map((f) => String(f))
        .filter(
          (key) =>
            schemaInvalidSet.has(key) ||
            form.getFieldState(key as keyof OnboardingFormValues).invalid
        );
      trackFormValidationFailed({
        feature: 'onboarding',
        formId: 'mentee_onboarding',
        invalidKeys:
          stepErrorKeys.length > 0 ? stepErrorKeys : [String(fields[0])],
        step: currentStep,
      });
      return false;
    }

    if (currentStep === 1) {
      const avatarFile = form.getValues('avatarFile');
      if (avatarFile) {
        avatarUpload.kickOff(avatarFile, form.getValues('avatar'));
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
      updateSession,
      navigate: (href: string) => router.push(href),
      revalidateProfilePath,
      ...portOverrides,
    }),
    [portOverrides, router, updateSession]
  );

  const submitOnboarding = useCallback(async (): Promise<void> => {
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
      trackFormValidationFailed({
        feature: 'onboarding',
        formId: 'mentee_onboarding',
        invalidKeys: Array.from(errorFieldNames),
        step: earliestStep ?? currentStep,
      });
      if (earliestStep && earliestStep !== currentStep) {
        setCurrentStep(earliestStep);
      }
      return;
    }

    const values: OnboardingFormValues = { ...parsed.data };

    try {
      setIsSubmitting(true);

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

      await commitProfileMutation(
        {
          mode: 'mentee-onboarding',
          values,
        },
        {
          pageUserId: session?.user?.id ? String(session.user.id) : undefined,
          session,
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
      setIsSubmitting(false);
    }
  }, [avatarUpload, currentStep, form, industries, savePort, session, toast]);

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
