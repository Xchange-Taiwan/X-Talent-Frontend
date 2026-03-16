'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import {
  formSchema,
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
} from '@/components/onboarding/steps';
import useLocations from '@/hooks/user/country/useLocations';
import useIndustries from '@/hooks/user/industry/useIndustries';
import useInterests from '@/hooks/user/interests/useInterests';
import { trackEvent } from '@/lib/analytics';
import { captureFlowFailure } from '@/lib/monitoring';
import { updateAvatar } from '@/services/profile/updateAvatar';
import { updateProfile } from '@/services/profile/updateProfile';
import { fetchUser } from '@/services/profile/user';

import { STEP_TITLE, STEPS_TOTAL } from './data';
import OnboardingUI from './ui';

export default function OnboardingContainer() {
  const router = useRouter();
  const { locations } = useLocations('zh_TW');
  const { industries } = useIndustries('zh_TW');
  const { interestedPositions, skills, topics } = useInterests('zh_TW');
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: session, status, update: updateSession } = useSession();

  const [tempData, setTempData] = useState<{
    step1?: z.infer<typeof step1Schema>;
    step2?: z.infer<typeof step2Schema>;
    step3?: z.infer<typeof step3Schema>;
    step4?: z.infer<typeof step4Schema>;
    step5?: z.infer<typeof step5Schema>;
  }>({});

  const stableOnboardingCacheBust = useRef(Date.now()).current;

  const step1Form = useForm<z.infer<typeof step1Schema>>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      name: '',
      avatarFile: undefined,
      avatar: '',
      language: 'zh_TW',
    },
  });

  const watchedAvatar = step1Form.watch('avatar');
  const avatarDisplayUrl = watchedAvatar
    ? `${watchedAvatar}?cb=${session?.user?.avatarUpdatedAt ?? stableOnboardingCacheBust}`
    : '';

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

  const onSubmitStep1 = (data: z.infer<typeof step1Schema>) => {
    setTempData((prev) => ({ ...prev, step1: data }));
    trackEvent({ name: 'onboarding_step_1_completed', feature: 'onboarding' });
    setCurrentStep(2);
  };

  const step2Form = useForm<z.infer<typeof step2Schema>>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      location: 'TWN',
      years_of_experience: '',
      industry: '',
      job_title: '',
      company: '',
    },
  });
  const onSubmitStep2 = (data: z.infer<typeof step2Schema>) => {
    setTempData((prev) => ({ ...prev, step2: data }));
    trackEvent({ name: 'onboarding_step_2_completed', feature: 'onboarding' });
    setCurrentStep(3);
  };

  const step3Form = useForm<z.infer<typeof step3Schema>>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      interested_positions: [],
    },
  });
  const onSubmitStep3 = (data: z.infer<typeof step3Schema>) => {
    setTempData((prev) => ({ ...prev, step3: data }));
    trackEvent({ name: 'onboarding_step_3_completed', feature: 'onboarding' });
    setCurrentStep(4);
  };

  const step4Form = useForm<z.infer<typeof step4Schema>>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      skills: [],
    },
  });
  const onSubmitStep4 = (data: z.infer<typeof step4Schema>) => {
    setTempData((prev) => ({ ...prev, step4: data }));
    trackEvent({ name: 'onboarding_step_4_completed', feature: 'onboarding' });
    setCurrentStep(5);
  };

  const step5Form = useForm<z.infer<typeof step5Schema>>({
    resolver: zodResolver(step5Schema),
    defaultValues: {
      topics: [],
    },
  });

  const onSubmitStep5 = async (data: z.infer<typeof step5Schema>) => {
    setTempData((prev) => ({ ...prev, step5: data }));
    const allData = {
      ...tempData.step1,
      ...tempData.step2,
      ...tempData.step3,
      ...tempData.step4,
      ...data,
    };

    try {
      setIsSubmitting(true);

      if (allData.avatarFile) {
        try {
          const newUrl = await updateAvatar(allData.avatarFile);
          allData.avatar = newUrl ?? allData.avatar;
          allData.avatarFile = undefined;
        } catch (err) {
          captureFlowFailure({
            flow: 'onboarding_submit',
            step: 'avatar_upload',
            message:
              err instanceof Error ? err.message : 'Avatar upload failed',
          });
          throw err;
        }
      }

      try {
        const validatedData = formSchema.parse(allData);
        await updateProfile(validatedData);
        const latest = await fetchUser('zh_TW');

        await updateSession({
          user: {
            id: session?.user?.id,
            name: latest?.name ?? validatedData.name ?? session?.user?.name,
            avatar:
              latest?.avatar ?? validatedData.avatar ?? session?.user?.avatar,
            isMentor: Boolean(latest?.is_mentor),
            onBoarding: Boolean(latest?.onboarding),
            msg: session?.user?.msg,
          },
        });
      } catch (err) {
        captureFlowFailure({
          flow: 'onboarding_submit',
          step: 'submit_profile',
          message:
            err instanceof Error
              ? err.message
              : 'Onboarding profile submit failed',
        });
        throw err;
      }

      trackEvent({ name: 'onboarding_completed', feature: 'onboarding' });
      router.push('/profile/card');
    } catch {
      // submit failed silently — user stays on page
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoToPrev = () => {
    setCurrentStep((s) => Math.max(1, s - 1));
  };

  return (
    <OnboardingUI
      currentStep={currentStep}
      stepsTotal={STEPS_TOTAL}
      stepTitle={STEP_TITLE}
      avatarDisplayUrl={avatarDisplayUrl}
      step1Form={step1Form}
      step2Form={step2Form}
      step3Form={step3Form}
      step4Form={step4Form}
      step5Form={step5Form}
      locations={locations}
      industries={industries}
      interestedPositions={interestedPositions}
      skills={skills}
      topics={topics}
      isSubmitting={isSubmitting}
      onGoToPrev={handleGoToPrev}
      onSubmitStep1={onSubmitStep1}
      onSubmitStep2={onSubmitStep2}
      onSubmitStep3={onSubmitStep3}
      onSubmitStep4={onSubmitStep4}
      onSubmitStep5={onSubmitStep5}
    />
  );
}
