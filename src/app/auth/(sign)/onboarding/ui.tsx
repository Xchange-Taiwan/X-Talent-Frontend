'use client';

import { ChevronLeft, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { UseFormReturn } from 'react-hook-form';
import * as z from 'zod';

import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  WhoAreYou,
} from '@/components/onboarding/steps';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { LocationType } from '@/services/profile/countries';
import { ProfessionVO } from '@/services/profile/industries';
import { InterestVO } from '@/services/profile/interests';

// Steps 2-5 are only rendered after the user completes step 1.
// Lazy-load them so their code is excluded from the initial bundle and
// downloaded in the background while the user fills in step 1.
const PersonalInfo = dynamic(() =>
  import('@/components/onboarding/steps/PersonalInfo').then((m) => ({
    default: m.PersonalInfo,
  }))
);
const InterestedPosition = dynamic(() =>
  import('@/components/onboarding/steps/InterestedPosition').then((m) => ({
    default: m.InterestedPosition,
  }))
);
const SkillsToImprove = dynamic(() =>
  import('@/components/onboarding/steps/SkillsToImprove').then((m) => ({
    default: m.SkillsToImprove,
  }))
);
const TopicsToDiscuss = dynamic(() =>
  import('@/components/onboarding/steps/TopicsToDiscuss').then((m) => ({
    default: m.TopicsToDiscuss,
  }))
);

interface Props {
  currentStep: number;
  stepsTotal: number;
  stepTitle: readonly string[];
  avatarDisplayUrl: string;
  step1Form: UseFormReturn<z.infer<typeof step1Schema>>;
  step2Form: UseFormReturn<z.infer<typeof step2Schema>>;
  step3Form: UseFormReturn<z.infer<typeof step3Schema>>;
  step4Form: UseFormReturn<z.infer<typeof step4Schema>>;
  step5Form: UseFormReturn<z.infer<typeof step5Schema>>;
  locations: LocationType[];
  industries: ProfessionVO[];
  interestedPositions: InterestVO[];
  skills: InterestVO[];
  topics: InterestVO[];
  isSubmitting: boolean;
  onGoToPrev: () => void;
  onSubmitStep1: (data: z.infer<typeof step1Schema>) => void;
  onSubmitStep2: (data: z.infer<typeof step2Schema>) => void;
  onSubmitStep3: (data: z.infer<typeof step3Schema>) => void;
  onSubmitStep4: (data: z.infer<typeof step4Schema>) => void;
  onSubmitStep5: (data: z.infer<typeof step5Schema>) => Promise<void>;
}

function StepHeader({
  currentStep,
  stepsTotal,
  stepTitle,
  showBack,
  onGoToPrev,
}: {
  currentStep: number;
  stepsTotal: number;
  stepTitle: readonly string[];
  showBack: boolean;
  onGoToPrev: () => void;
}) {
  return (
    <div>
      <p className="mb-6 text-base font-semibold text-text-tertiary">
        步驟 {currentStep} / {stepsTotal}
      </p>
      <div className="flex items-center gap-3">
        {showBack && (
          <ChevronLeft
            className="h-6 w-6 cursor-pointer"
            onClick={onGoToPrev}
          />
        )}
        <p className="text-4xl font-bold">{stepTitle[currentStep - 1]}</p>
      </div>
    </div>
  );
}

export default function OnboardingUI({
  currentStep,
  stepsTotal,
  stepTitle,
  avatarDisplayUrl,
  step1Form,
  step2Form,
  step3Form,
  step4Form,
  step5Form,
  locations,
  industries,
  interestedPositions,
  skills,
  topics,
  isSubmitting,
  onGoToPrev,
  onSubmitStep1,
  onSubmitStep2,
  onSubmitStep3,
  onSubmitStep4,
  onSubmitStep5,
}: Props) {
  return (
    <div className="flex-1">
      <div className="mx-auto max-w-[600px] px-5 py-20">
        {currentStep === 1 && (
          <Form {...step1Form}>
            <form
              onSubmit={step1Form.handleSubmit(onSubmitStep1)}
              className="space-y-10"
            >
              <StepHeader
                currentStep={currentStep}
                stepsTotal={stepsTotal}
                stepTitle={stepTitle}
                showBack={false}
                onGoToPrev={onGoToPrev}
              />
              <WhoAreYou form={step1Form} avatarUrl={avatarDisplayUrl} />
              <Button className="rounded-xl px-12" type="submit">
                下一步
              </Button>
            </form>
          </Form>
        )}

        {currentStep === 2 && (
          <Form {...step2Form}>
            <form
              onSubmit={step2Form.handleSubmit(onSubmitStep2)}
              className="space-y-10"
            >
              <StepHeader
                currentStep={currentStep}
                stepsTotal={stepsTotal}
                stepTitle={stepTitle}
                showBack={true}
                onGoToPrev={onGoToPrev}
              />
              <PersonalInfo
                form={step2Form}
                locationOptions={locations}
                industryOptions={industries}
              />
              <Button className="rounded-xl px-12" type="submit">
                下一步
              </Button>
            </form>
          </Form>
        )}

        {currentStep === 3 && (
          <Form {...step3Form}>
            <form
              onSubmit={step3Form.handleSubmit(onSubmitStep3)}
              className="space-y-10"
            >
              <StepHeader
                currentStep={currentStep}
                stepsTotal={stepsTotal}
                stepTitle={stepTitle}
                showBack={true}
                onGoToPrev={onGoToPrev}
              />
              <InterestedPosition
                form={step3Form}
                interestedPositionOptions={interestedPositions}
              />
              <Button className="rounded-xl px-12" type="submit">
                下一步
              </Button>
            </form>
          </Form>
        )}

        {currentStep === 4 && (
          <Form {...step4Form}>
            <form
              onSubmit={step4Form.handleSubmit(onSubmitStep4)}
              className="space-y-10"
            >
              <StepHeader
                currentStep={currentStep}
                stepsTotal={stepsTotal}
                stepTitle={stepTitle}
                showBack={true}
                onGoToPrev={onGoToPrev}
              />
              <SkillsToImprove form={step4Form} skillOptions={skills} />
              <Button className="rounded-xl px-12" type="submit">
                下一步
              </Button>
            </form>
          </Form>
        )}

        {currentStep === 5 && (
          <Form {...step5Form}>
            <form
              onSubmit={step5Form.handleSubmit(onSubmitStep5)}
              className="space-y-10"
            >
              <StepHeader
                currentStep={currentStep}
                stepsTotal={stepsTotal}
                stepTitle={stepTitle}
                showBack={true}
                onGoToPrev={onGoToPrev}
              />
              <TopicsToDiscuss form={step5Form} topicOptions={topics} />
              <Button
                className="rounded-xl px-12"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    提交
                  </>
                ) : (
                  '提交'
                )}
              </Button>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
