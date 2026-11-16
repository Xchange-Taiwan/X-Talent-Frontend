import { zodResolver } from '@hookform/resolvers/zod';
import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  type OnboardingStepNumber,
  STEP_FIELDS,
} from '@/hooks/user/onboarding/useOnboardingForm';
import { FOCUS_RING_CLASSES } from '@/lib/ui/focusRing';
import { formSchema, type OnboardingFormValues } from '@/schemas/onboarding';
import {
  mockIndustryOptions,
  mockPositionGroups,
  mockSkillGroups,
  mockTopicGroups,
} from '@/test/fixtures/tagCatalog';
import type { LocationType } from '@/types/location';

import OnboardingUI from './ui';

const mockLocations: LocationType[] = [
  { value: 'TWN', text: '台灣 (Taiwan)' },
  { value: 'USA', text: '美國 (United States)' },
  { value: 'JPN', text: '日本 (Japan)' },
  { value: 'SGP', text: '新加坡 (Singapore)' },
  { value: 'HKG', text: '香港 (Hong Kong)' },
];

const STEP_TITLE = [
  '該如何稱呼你呢？',
  '個人資訊',
  '有興趣多了解的職位',
  '想多了解、加強的技能',
  '想多了解的主題',
] as const;

const STEPS_TOTAL = STEP_TITLE.length;

function OnboardingUIWizardDemo() {
  const [currentStep, setCurrentStep] = useState<OnboardingStepNumber>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [submittedData, setSubmittedData] = useState<unknown>(null);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '張君雅',
      avatar:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      avatarFile: undefined,
      language: 'zh_TW',
      location: 'TWN',
      years_of_experience: '1~3 年',
      industry: 'tech_software',
      want_position: ['frontend_developer'],
      want_skill: ['typescript', 'react'],
      want_topic: ['career_planning'],
    },
  });

  const onGoToPrev = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1) as OnboardingStepNumber);
  };

  const onNextStep = async (): Promise<boolean> => {
    const valid = await form.trigger(STEP_FIELDS[currentStep]);
    if (!valid) return false;
    setCurrentStep((prev) => Math.min(5, prev + 1) as OnboardingStepNumber);
    return true;
  };

  const onSubmit = async (): Promise<void> => {
    const valid = await form.trigger(STEP_FIELDS[5]);
    if (!valid) return;
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSubmitting(false);
    setCompleted(true);
    setSubmittedData(form.getValues());
  };

  const resetAll = () => {
    form.reset();
    setCurrentStep(1);
    setCompleted(false);
    setSubmittedData(null);
  };

  if (completed) {
    return (
      <div className="mx-auto max-w-[600px] px-5 py-20 text-center">
        <h2 className="text-status-success-default mb-4 text-3xl font-bold">
          🎉 註冊導引完成！
        </h2>
        <p className="text-text-secondary mb-6">
          您已成功填寫所有步驟的註冊導引資訊。
        </p>
        <div className="border-border bg-background-bottom-secondary mb-6 max-h-[300px] overflow-auto rounded-lg border p-4 text-left font-mono text-sm">
          <pre>{JSON.stringify(submittedData, null, 2)}</pre>
        </div>
        <button
          onClick={resetAll}
          className={`bg-brand-500 text-text-white hover:bg-brand-600 rounded-lg px-6 py-2.5 font-semibold ${FOCUS_RING_CLASSES}`}
        >
          重新開始
        </button>
      </div>
    );
  }

  return (
    <OnboardingUI
      currentStep={currentStep}
      stepsTotal={STEPS_TOTAL}
      stepTitle={STEP_TITLE}
      form={form}
      locations={mockLocations}
      industries={mockIndustryOptions}
      wantPositionGroups={mockPositionGroups}
      wantSkillGroups={mockSkillGroups}
      wantTopicGroups={mockTopicGroups}
      isSubmitting={isSubmitting}
      onGoToPrev={onGoToPrev}
      onNextStep={onNextStep}
      onSubmit={onSubmit}
    />
  );
}

const meta: Meta<typeof OnboardingUI> = {
  title: 'Onboarding/Wizard/IntegratedWizard',
  component: OnboardingUI,
  parameters: {
    layout: 'fullscreen',
    session: {
      user: {
        id: 'user-id-123',
        name: '張君雅',
        avatar:
          'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
        avatarUpdatedAt: 123456789,
        isMentor: false,
      },
      expires: '2027-01-01T00:00:00.000Z',
    },
  },
};

export default meta;
type Story = StoryObj<typeof OnboardingUI>;

export const InteractiveWizard: Story = {
  render: () => <OnboardingUIWizardDemo />,
};
