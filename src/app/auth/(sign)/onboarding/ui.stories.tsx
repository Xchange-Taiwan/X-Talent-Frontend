import { zodResolver } from '@hookform/resolvers/zod';
import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
} from '@/schemas/onboarding';
import { LocationType } from '@/services/profile/countries';
import {
  mockIndustryOptions,
  mockPositionGroups,
  mockSkillGroups,
  mockTopicGroups,
} from '@/test/fixtures/tagCatalog';

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
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [submittedData, setSubmittedData] = useState<unknown>(null);

  const step1Form = useForm<z.infer<typeof step1Schema>>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      name: '張君雅',
      avatar:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      avatarFile: undefined,
      language: 'zh_TW',
    },
  });

  const step2Form = useForm<z.infer<typeof step2Schema>>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      location: 'TWN',
      years_of_experience: '1~3 年',
      industry: 'tech_software',
    },
  });

  const step3Form = useForm<z.infer<typeof step3Schema>>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      want_position: ['frontend_developer'],
    },
  });

  const step4Form = useForm<z.infer<typeof step4Schema>>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      want_skill: ['typescript', 'react'],
    },
  });

  const step5Form = useForm<z.infer<typeof step5Schema>>({
    resolver: zodResolver(step5Schema),
    defaultValues: {
      want_topic: ['career_planning'],
    },
  });

  const onGoToPrev = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const onSubmitStep1 = (data: z.infer<typeof step1Schema>) => {
    console.log('Step 1 Data:', data);
    setCurrentStep(2);
  };

  const onSubmitStep2 = (data: z.infer<typeof step2Schema>) => {
    console.log('Step 2 Data:', data);
    setCurrentStep(3);
  };

  const onSubmitStep3 = (data: z.infer<typeof step3Schema>) => {
    console.log('Step 3 Data:', data);
    setCurrentStep(4);
  };

  const onSubmitStep4 = (data: z.infer<typeof step4Schema>) => {
    console.log('Step 4 Data:', data);
    setCurrentStep(5);
  };

  const onSubmitStep5 = async (data: z.infer<typeof step5Schema>) => {
    console.log('Step 5 Data:', data);
    setIsSubmitting(true);
    // Simulate API Submission delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSubmitting(false);
    setCompleted(true);
    setSubmittedData({
      step1: step1Form.getValues(),
      step2: step2Form.getValues(),
      step3: step3Form.getValues(),
      step4: step4Form.getValues(),
      step5: data,
    });
  };

  const resetAll = () => {
    step1Form.reset();
    step2Form.reset();
    step3Form.reset();
    step4Form.reset();
    step5Form.reset();
    setCurrentStep(1);
    setCompleted(false);
    setSubmittedData(null);
  };

  if (completed) {
    return (
      <div className="mx-auto max-w-[600px] px-5 py-20 text-center">
        <h2 className="mb-4 text-3xl font-bold text-status-success-default">
          🎉 註冊導引完成！
        </h2>
        <p className="mb-6 text-text-secondary">
          您已成功填寫所有步驟的註冊導引資訊。
        </p>
        <div className="mb-6 max-h-[300px] overflow-auto rounded-lg border border-border bg-background-bottom-secondary p-4 text-left font-mono text-sm">
          <pre>{JSON.stringify(submittedData, null, 2)}</pre>
        </div>
        <button
          onClick={resetAll}
          className="rounded-lg bg-brand-500 px-6 py-2.5 font-semibold text-text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
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
      step1Form={step1Form}
      step2Form={step2Form}
      step3Form={step3Form}
      step4Form={step4Form}
      step5Form={step5Form}
      locations={mockLocations}
      industries={mockIndustryOptions}
      wantPositionGroups={mockPositionGroups}
      wantSkillGroups={mockSkillGroups}
      wantTopicGroups={mockTopicGroups}
      isSubmitting={isSubmitting}
      onGoToPrev={onGoToPrev}
      onSubmitStep1={onSubmitStep1}
      onSubmitStep2={onSubmitStep2}
      onSubmitStep3={onSubmitStep3}
      onSubmitStep4={onSubmitStep4}
      onSubmitStep5={onSubmitStep5}
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
