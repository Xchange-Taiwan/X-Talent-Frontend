'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import ArrowBackIcon from '@mui/icons-material/ArrowBackIosNew';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import {
  formSchema,
  InterestedPosition,
  PersonalInfo,
  SkillsToImprove,
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  TopicsToDiscuss,
  WhoAreYou,
} from '@/components/onboarding/Steps';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import useLocations from '@/hooks/user/country/useLocations';
import useIndustries from '@/hooks/user/industry/useIndustries';
import useInterests from '@/hooks/user/interests/useInterests';
import { updateAvatar } from '@/services/auth/updateAvatar';
import { updateProfile } from '@/services/auth/updateProfile';

const STEP_TITLE = [
  '該如何稱呼你呢？',
  '個人資訊',
  '有興趣多了解的職位',
  '想多了解、加強的技能',
  '想多了解的主題',
];
const stepsTotal = STEP_TITLE.length;

export default function Page() {
  const router = useRouter();

  const { locations } = useLocations('zh_TW');
  const { industries } = useIndustries('zh_TW');
  const { interestedPositions, skills, topics } = useInterests('zh_TW');

  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    const name = sessionStorage.getItem('name');
    let avatar = sessionStorage.getItem('avatar');

    if (avatar) {
      avatar = avatar.slice(0, avatar.lastIndexOf('='));
    }

    step1Form.reset({
      name: name || '',
      avatar: avatar || '',
      avatarFile: undefined,
      language: 'zh_TW',
    });
  }, []);

  const [tempData, setTempData] = useState<{
    step1?: z.infer<typeof step1Schema>;
    step2?: z.infer<typeof step2Schema>;
    step3?: z.infer<typeof step3Schema>;
    step4?: z.infer<typeof step4Schema>;
    step5?: z.infer<typeof step5Schema>;
  }>({});

  const step1Form = useForm<z.infer<typeof step1Schema>>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      name: '',
      avatarFile: undefined,
      avatar: '',
      language: 'zh_TW',
    },
  });
  const onSubmitStep1 = (data: z.infer<typeof step1Schema>) => {
    setTempData((prev) => ({ ...prev, step1: data }));
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
      linkedin_profile: '',
    },
  });
  const onSubmitStep2 = (data: z.infer<typeof step2Schema>) => {
    setTempData((prev) => ({ ...prev, step2: data }));
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
      if (allData.avatarFile) {
        allData.avatar = await updateAvatar(allData.avatarFile);
        allData.avatarFile = undefined;
      }
      const validatedData = formSchema.parse(allData);
      await updateProfile(validatedData);

      router.push('/profile/card');
    } catch (error) {
      console.error('提交失敗:', error);
    }
  };

  const handleGoToPrev = () => {
    setCurrentStep((s) => Math.max(1, s - 1));
  };

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-[600px] px-5 py-20">
        {currentStep === 1 && (
          <Form {...step1Form}>
            <form
              onSubmit={step1Form.handleSubmit(onSubmitStep1)}
              className="space-y-10"
            >
              <div>
                <p className="mb-6 text-base font-semibold text-text-tertiary">
                  Step {currentStep} of {stepsTotal}
                </p>
                <div className="flex items-center gap-3">
                  <p className="text-4xl font-bold">
                    {STEP_TITLE[currentStep - 1]}
                  </p>
                </div>
              </div>

              <div>
                <WhoAreYou
                  form={step1Form}
                  avatarUrl={step1Form.getValues().avatar || ''}
                />
              </div>

              <div>
                <Button className="rounded-xl px-12" type="submit">
                  下一步
                </Button>
              </div>
            </form>
          </Form>
        )}

        {currentStep === 2 && (
          <Form {...step2Form}>
            <form
              onSubmit={step2Form.handleSubmit(onSubmitStep2)}
              className="space-y-10"
            >
              <div>
                <p className="mb-6 text-base font-semibold text-text-tertiary">
                  Step {currentStep} of {stepsTotal}
                </p>
                <div className="flex items-center gap-3">
                  {currentStep > 1 && (
                    <ArrowBackIcon
                      className="cursor-pointer"
                      onClick={handleGoToPrev}
                    />
                  )}
                  <p className="text-4xl font-bold">
                    {STEP_TITLE[currentStep - 1]}
                  </p>
                </div>
              </div>

              <div>
                <PersonalInfo
                  form={step2Form}
                  locationOptions={locations}
                  industryOptions={industries}
                />
              </div>

              <div>
                <Button className="rounded-xl px-12" type="submit">
                  下一步
                </Button>
              </div>
            </form>
          </Form>
        )}

        {currentStep === 3 && (
          <Form {...step3Form}>
            <form
              onSubmit={step3Form.handleSubmit(onSubmitStep3)}
              className="space-y-10"
            >
              <div>
                <p className="mb-6 text-base font-semibold text-text-tertiary">
                  Step {currentStep} of {stepsTotal}
                </p>
                <div className="flex items-center gap-3">
                  {currentStep > 1 && (
                    <ArrowBackIcon
                      className="cursor-pointer"
                      onClick={handleGoToPrev}
                    />
                  )}
                  <p className="text-4xl font-bold">
                    {STEP_TITLE[currentStep - 1]}
                  </p>
                </div>
              </div>

              <div>
                <InterestedPosition
                  form={step3Form}
                  interestedPositionOptions={interestedPositions}
                />
              </div>

              <div>
                <Button className="rounded-xl px-12" type="submit">
                  下一步
                </Button>
              </div>
            </form>
          </Form>
        )}

        {currentStep === 4 && (
          <Form {...step4Form}>
            <form
              onSubmit={step4Form.handleSubmit(onSubmitStep4)}
              className="space-y-10"
            >
              <div>
                <p className="mb-6 text-base font-semibold text-text-tertiary">
                  Step {currentStep} of {stepsTotal}
                </p>
                <div className="flex items-center gap-3">
                  {currentStep > 1 && (
                    <ArrowBackIcon
                      className="cursor-pointer"
                      onClick={handleGoToPrev}
                    />
                  )}
                  <p className="text-4xl font-bold">
                    {STEP_TITLE[currentStep - 1]}
                  </p>
                </div>
              </div>

              <div>
                <SkillsToImprove form={step4Form} skillOptions={skills} />
              </div>

              <div>
                <Button className="rounded-xl px-12" type="submit">
                  下一步
                </Button>
              </div>
            </form>
          </Form>
        )}

        {currentStep === 5 && (
          <Form {...step5Form}>
            <form
              onSubmit={step5Form.handleSubmit(onSubmitStep5)}
              className="space-y-10"
            >
              <div>
                <p className="mb-6 text-base font-semibold text-text-tertiary">
                  Step {currentStep} of {stepsTotal}
                </p>
                <div className="flex items-center gap-3">
                  {currentStep > 1 && (
                    <ArrowBackIcon
                      className="cursor-pointer"
                      onClick={handleGoToPrev}
                    />
                  )}
                  <p className="text-4xl font-bold">
                    {STEP_TITLE[currentStep - 1]}
                  </p>
                </div>
              </div>

              <div>
                <TopicsToDiscuss form={step5Form} topicOptions={topics} />
              </div>

              <div>
                <Button className="rounded-xl px-12" type="submit">
                  提交
                </Button>
              </div>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
