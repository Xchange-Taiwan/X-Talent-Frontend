'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { useToast } from '@/components/ui/use-toast';
import { useOnboardingSubmit } from '@/hooks/user/onboarding/useOnboardingSubmit';
import { useBackgroundAvatarUpload } from '@/hooks/user/profile/useBackgroundAvatarUpload';
import { trackEvent } from '@/lib/analytics';
import { captureFlowFailure } from '@/lib/monitoring';
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
} from '@/schemas/onboarding';
import type { TagCatalogsByBucket } from '@/services/profile/tagCatalog';

interface Options {
  industries: TagCatalogsByBucket['industry'];
}

export function useOnboardingForm({ industries }: Options) {
  const router = useRouter();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: session, status } = useSession();

  const [accumulatedFormData, setAccumulatedFormData] = useState<{
    step1?: z.infer<typeof step1Schema>;
    step2?: z.infer<typeof step2Schema>;
    step3?: z.infer<typeof step3Schema>;
    step4?: z.infer<typeof step4Schema>;
    step5?: z.infer<typeof step5Schema>;
  }>({});

  const avatarUpload = useBackgroundAvatarUpload();
  const { submitProfile } = useOnboardingSubmit({ industries });

  const step1Form = useForm<z.infer<typeof step1Schema>>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      name: '',
      avatarFile: undefined,
      avatar: '',
      language: 'zh_TW',
    },
  });

  useEffect(() => {
    if (status === 'loading') return;
    const name = session?.user?.name ?? '';
    const avatar = session?.user?.avatar ?? '';
    step1Form.reset({
      name: name || '',
      avatar: avatar || '',
      avatarFile: undefined,
      language: 'zh_TW',
    });
  }, [session?.user?.name, session?.user?.avatar, status, step1Form]);

  // Track which onboarding step the user is currently viewing
  useEffect(() => {
    trackEvent({
      name: 'onboarding_step_viewed',
      feature: 'onboarding',
      metadata: { step: currentStep },
    });
  }, [currentStep]);

  const watchedAvatarFile = step1Form.watch('avatarFile');
  useEffect(() => {
    if (watchedAvatarFile) step1Form.clearErrors('avatarFile');
  }, [watchedAvatarFile, step1Form]);

  const onSubmitStep1 = (data: z.infer<typeof step1Schema>) => {
    setAccumulatedFormData((prev) => ({ ...prev, step1: data }));
    if (data.avatarFile) {
      avatarUpload.kickOff(data.avatarFile, step1Form.getValues('avatar'));
    } else {
      avatarUpload.abort();
    }
    trackEvent({ name: 'onboarding_step_1_completed', feature: 'onboarding' });
    setCurrentStep(2);
  };

  const handleStepSubmit = <T>(
    stepKey: 'step2' | 'step3' | 'step4',
    stepNum: number,
    data: T
  ) => {
    setAccumulatedFormData((prev) => ({ ...prev, [stepKey]: data }));
    trackEvent({
      name: `onboarding_step_${stepNum}_completed`,
      feature: 'onboarding',
    });
    setCurrentStep(stepNum + 1);
  };

  const step2Form = useForm<z.infer<typeof step2Schema>>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      location: 'TWN',
      years_of_experience: '',
      industry: '',
    },
  });
  const onSubmitStep2 = (data: z.infer<typeof step2Schema>) => {
    handleStepSubmit('step2', 2, data);
  };

  const step3Form = useForm<z.infer<typeof step3Schema>>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      want_position: [],
    },
  });
  const onSubmitStep3 = (data: z.infer<typeof step3Schema>) => {
    handleStepSubmit('step3', 3, data);
  };

  const step4Form = useForm<z.infer<typeof step4Schema>>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      want_skill: [],
    },
  });
  const onSubmitStep4 = (data: z.infer<typeof step4Schema>) => {
    handleStepSubmit('step4', 4, data);
  };

  const step5Form = useForm<z.infer<typeof step5Schema>>({
    resolver: zodResolver(step5Schema),
    defaultValues: {
      want_topic: [],
    },
  });

  const onSubmitStep5 = async (data: z.infer<typeof step5Schema>) => {
    setAccumulatedFormData((prev) => ({ ...prev, step5: data }));
    const allData = {
      ...accumulatedFormData.step1,
      ...accumulatedFormData.step2,
      ...accumulatedFormData.step3,
      ...accumulatedFormData.step4,
      ...data,
    };

    try {
      setIsSubmitting(true);

      if (allData.avatarFile) {
        try {
          const newUrl = await avatarUpload.consume(allData.avatarFile);
          allData.avatar = newUrl ?? allData.avatar;
          allData.avatarFile = undefined;
        } catch (err) {
          captureFlowFailure({
            flow: 'onboarding_submit',
            step: 'avatar_upload',
            message:
              err instanceof Error ? err.message : 'Avatar upload failed',
            level: 'warning',
          });
          avatarUpload.abort();
          step1Form.setError('avatarFile', {
            type: 'custom',
            message: '頭像上傳失敗，請重新選擇。',
          });
          setCurrentStep(1);
          setIsSubmitting(false);
          return;
        }
      }

      await submitProfile(
        allData,
        Boolean(accumulatedFormData.step1?.avatarFile)
      );

      trackEvent({ name: 'onboarding_completed', feature: 'onboarding' });
      router.push('/profile/card');
    } catch {
      toast({
        variant: 'destructive',
        description: '儲存失敗，請稍後再試。',
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoToPrev = () => {
    setCurrentStep((s) => Math.max(1, s - 1));
  };

  return {
    currentStep,
    isSubmitting,
    step1Form,
    step2Form,
    step3Form,
    step4Form,
    step5Form,
    onSubmitStep1,
    onSubmitStep2,
    onSubmitStep3,
    onSubmitStep4,
    onSubmitStep5,
    handleGoToPrev,
  };
}
