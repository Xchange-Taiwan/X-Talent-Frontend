'use client';

import useLocations from '@/hooks/user/country/useLocations';
import { useOnboardingForm } from '@/hooks/user/onboarding/useOnboardingForm';
import useTagCatalog from '@/hooks/user/tags/useTagCatalog';
import type { TagCatalogsByBucket } from '@/types/tagCatalog';

import OnboardingUI from './ui';

interface Props {
  initialTagCatalog: TagCatalogsByBucket;
}

export default function OnboardingContainer({ initialTagCatalog }: Props) {
  const { locations } = useLocations('zh_TW');
  const tagCatalog = useTagCatalog('zh_TW', initialTagCatalog);

  const {
    isSubmitting,
    role,
    setRole,
    form,
    formRef,
    directionMap,
    setDirectionMap,
    handleAvatarFileChange,
    handleSelectPresetAvatar,
    submitOnboarding,
  } = useOnboardingForm({ industries: tagCatalog.industry });

  return (
    <OnboardingUI
      role={role}
      onRoleChange={setRole}
      form={form}
      formRef={formRef}
      locations={locations}
      industries={tagCatalog.industry}
      haveTopicGroups={tagCatalog.have_topic}
      haveSkillGroups={tagCatalog.have_skill}
      wantPositionGroups={tagCatalog.want_position}
      wantSkillGroups={tagCatalog.want_skill}
      wantTopicGroups={tagCatalog.want_topic}
      directionMap={directionMap}
      onDirectionMapChange={setDirectionMap}
      onAvatarFileChange={handleAvatarFileChange}
      onSelectPresetAvatar={handleSelectPresetAvatar}
      isSubmitting={isSubmitting}
      onSubmit={submitOnboarding}
    />
  );
}
