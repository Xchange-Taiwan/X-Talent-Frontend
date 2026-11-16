'use client';

import { ChevronLeft, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import type { FormEvent } from 'react';
import { UseFormReturn } from 'react-hook-form';

import { WhoAreYou } from '@/components/onboarding/steps';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import type { OnboardingFormValues } from '@/schemas/onboarding';
import type { LocationType } from '@/types/location';
import type { IndustryOption, TagCatalogGroupVO } from '@/types/tagCatalog';

const PersonalInfo = dynamic<{
  form: UseFormReturn<OnboardingFormValues>;
  locationOptions: LocationType[];
  industryOptions: IndustryOption[];
}>(() =>
  import('@/components/onboarding/steps/PersonalInfo').then((m) => ({
    default: m.PersonalInfo,
  }))
);
const InterestedPosition = dynamic<{
  form: UseFormReturn<OnboardingFormValues>;
  wantPositionGroups: TagCatalogGroupVO[];
  maxSelected?: number;
}>(() =>
  import('@/components/onboarding/steps/InterestedPosition').then((m) => ({
    default: m.InterestedPosition,
  }))
);
const SkillsToImprove = dynamic<{
  form: UseFormReturn<OnboardingFormValues>;
  wantSkillGroups: TagCatalogGroupVO[];
  maxSelected?: number;
}>(() =>
  import('@/components/onboarding/steps/SkillsToImprove').then((m) => ({
    default: m.SkillsToImprove,
  }))
);
const TopicsToDiscuss = dynamic<{
  form: UseFormReturn<OnboardingFormValues>;
  wantTopicGroups: TagCatalogGroupVO[];
  maxSelected?: number;
}>(() =>
  import('@/components/onboarding/steps/TopicsToDiscuss').then((m) => ({
    default: m.TopicsToDiscuss,
  }))
);

interface Props {
  currentStep: number;
  stepsTotal: number;
  stepTitle: readonly string[];
  form: UseFormReturn<OnboardingFormValues>;
  locations: LocationType[];
  industries: IndustryOption[];
  wantPositionGroups: TagCatalogGroupVO[];
  wantSkillGroups: TagCatalogGroupVO[];
  wantTopicGroups: TagCatalogGroupVO[];
  isSubmitting: boolean;
  onGoToPrev: () => void;
  onNextStep: () => Promise<boolean>;
  onSubmit: () => Promise<void>;
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
      <p className="text-text-tertiary mb-6 text-base font-semibold">
        步驟 {currentStep} / {stepsTotal}
      </p>
      <div className="flex items-center gap-3">
        {showBack && (
          <ChevronLeft className="size-6 cursor-pointer" onClick={onGoToPrev} />
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
  form,
  locations,
  industries,
  wantPositionGroups,
  wantSkillGroups,
  wantTopicGroups,
  isSubmitting,
  onGoToPrev,
  onNextStep,
  onSubmit,
}: Props) {
  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (currentStep < stepsTotal) {
      void onNextStep();
    } else {
      void onSubmit();
    }
  };

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-[600px] px-5 py-20">
        <Form {...form}>
          <form onSubmit={handleFormSubmit} className="space-y-10">
            <StepHeader
              currentStep={currentStep}
              stepsTotal={stepsTotal}
              stepTitle={stepTitle}
              showBack={currentStep > 1}
              onGoToPrev={onGoToPrev}
            />

            {currentStep === 1 && <WhoAreYou form={form} />}
            {currentStep === 2 && (
              <PersonalInfo
                form={form}
                locationOptions={locations}
                industryOptions={industries}
              />
            )}
            {currentStep === 3 && (
              <InterestedPosition
                form={form}
                wantPositionGroups={wantPositionGroups}
              />
            )}
            {currentStep === 4 && (
              <SkillsToImprove form={form} wantSkillGroups={wantSkillGroups} />
            )}
            {currentStep === 5 && (
              <TopicsToDiscuss form={form} wantTopicGroups={wantTopicGroups} />
            )}

            {currentStep < stepsTotal ? (
              <Button className="rounded-xl px-12" type="submit">
                下一步
              </Button>
            ) : (
              <Button
                className="rounded-xl px-12"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    提交
                  </>
                ) : (
                  '提交'
                )}
              </Button>
            )}
          </form>
        </Form>
      </div>
    </div>
  );
}
