'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import ArrowBackIcon from '@mui/icons-material/ArrowBackIosNew';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import {
  formSchema,
  InterestedPosition,
  PersonalInfo,
  SkillsToImprove,
  TopicsToDiscuss,
  WhoAreYou,
} from '@/components/onboarding/Steps';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { useMultiStepForm } from '@/hooks/useMultiStepForm';
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

export default function Page() {
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      avatar: '',
      avatarFile: undefined,
      location: 'TWN',
      years_of_experience: '',
      industry: '',
      job_title: '',
      company: '',
      linkedin_profile: '',
      interested_positions: [],
      skills: [],
      topics: [],
      language: 'zh_TW',
    },
  });

  const { locations } = useLocations('zh_TW');
  const { interestedPositions, skills, topics } = useInterests('zh_TW');
  const { industries } = useIndustries('zh_TW');

  const {
    stepElement,
    goToNext,
    goToPrev,
    isLastStep,
    currentStep,
    stepsTotal,
  } = useMultiStepForm([
    <WhoAreYou key="WhoAreYou" form={form} />,
    <PersonalInfo
      key="PersonalInfo"
      form={form}
      locationOptions={locations}
      industryOptions={industries}
    />,
    <InterestedPosition
      key="InterestedPosition"
      form={form}
      interestedPositionOptions={interestedPositions}
    />,
    <SkillsToImprove key="SkillsToImprove" form={form} skillOptions={skills} />,
    <TopicsToDiscuss key="TopicsToDiscuss" form={form} topicOptions={topics} />,
  ]);

  const handleGoToNext = () => {
    goToNext();
  };

  const handleGoToPrev = () => {
    goToPrev();
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      handleGoToNext();

      if (isLastStep) {
        if (values.avatarFile) {
          values.avatar = await updateAvatar(values.avatarFile);
          values.avatarFile = undefined;
        }

        await updateProfile(values);
        router.push('/profile/card');
      }
    } catch (error) {
      console.error(
        '提交失敗:',
        error instanceof Error ? error.message : error,
      );
    }
  };

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-[600px] px-5 py-20">
        <Form {...form}>
          {currentStep > 0 && (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
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

              <div>{stepElement}</div>

              <div>
                <Button className="rounded-xl px-12" type="submit">
                  下一步
                </Button>
              </div>
            </form>
          )}
        </Form>
      </div>
    </div>
  );
}
