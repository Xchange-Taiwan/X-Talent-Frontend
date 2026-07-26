'use client';

import useLocations from '@/hooks/user/country/useLocations';
import { useOnboardingForm } from '@/hooks/user/onboarding/useOnboardingForm';
import useTagCatalog from '@/hooks/user/tags/useTagCatalog';
import type { TagCatalogsByBucket } from '@/services/profile/tagCatalog';

import { STEP_TITLE, STEPS_TOTAL } from './data';
import OnboardingUI from './ui';

interface Props {
  initialTagCatalog: TagCatalogsByBucket;
}

export default function OnboardingContainer({ initialTagCatalog }: Props) {
  const { locations } = useLocations('zh_TW');
  const {
    want_position: wantPositionGroups,
    want_skill: wantSkillGroups,
    want_topic: wantTopicGroups,
    industry: industries,
  } = useTagCatalog('zh_TW', initialTagCatalog);

  const {
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
  } = useOnboardingForm({ industries });

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
      locations={locations}
      industries={industries}
      wantPositionGroups={wantPositionGroups}
      wantSkillGroups={wantSkillGroups}
      wantTopicGroups={wantTopicGroups}
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
