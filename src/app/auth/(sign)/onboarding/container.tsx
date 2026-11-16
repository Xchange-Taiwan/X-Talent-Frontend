'use client';

import useLocations from '@/hooks/user/country/useLocations';
import { useOnboardingForm } from '@/hooks/user/onboarding/useOnboardingForm';
import useTagCatalog from '@/hooks/user/tags/useTagCatalog';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';

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
    form,
    advanceStep,
    submitOnboarding,
    handleGoToPrev,
  } = useOnboardingForm({ industries });

  return (
    <OnboardingUI
      currentStep={currentStep}
      stepsTotal={STEPS_TOTAL}
      stepTitle={STEP_TITLE}
      form={form}
      locations={locations}
      industries={industries}
      wantPositionGroups={wantPositionGroups}
      wantSkillGroups={wantSkillGroups}
      wantTopicGroups={wantTopicGroups}
      isSubmitting={isSubmitting}
      onGoToPrev={handleGoToPrev}
      onNextStep={advanceStep}
      onSubmit={submitOnboarding}
    />
  );
}
