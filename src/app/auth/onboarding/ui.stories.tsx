import { zodResolver } from '@hookform/resolvers/zod';
import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';

import type { MenteeDirectionMap } from '@/lib/profile/menteeDirectionPreference';
import {
  onboardingDefaultValues,
  onboardingFormSchema,
  type OnboardingRole,
  type ProfileFormValues,
} from '@/schemas/profileSchema';
import type { TagCatalogGroupVO } from '@/types/tagCatalog';

import OnboardingUI from './ui';

const SAMPLE_GROUPS: TagCatalogGroupVO[] = [
  {
    language: 'zh_TW',
    subject_group: 'software',
    subject: '軟體開發',
    leaves: [
      {
        tag_id: 1,
        language: 'zh_TW',
        subject_group: 'fe',
        subject: '前端工程師',
      },
      {
        tag_id: 2,
        language: 'zh_TW',
        subject_group: 'react',
        subject: 'React',
      },
      {
        tag_id: 3,
        language: 'zh_TW',
        subject_group: 'resume',
        subject: '履歷健檢',
      },
    ],
  },
];

function OnboardingStoryDemo({
  initialRole,
  enableDualTrackRoleSelect = false,
}: {
  initialRole: OnboardingRole;
  enableDualTrackRoleSelect?: boolean;
}) {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(onboardingFormSchema),
    defaultValues: {
      ...onboardingDefaultValues,
      role: initialRole,
      name: '陳大明 Alex Chen',
    },
  });
  const [directionMap, setDirectionMap] = useState<MenteeDirectionMap>({});
  const role = form.watch('role') ?? initialRole;

  return (
    <OnboardingUI
      role={role}
      onRoleChange={(next) => form.setValue('role', next)}
      enableDualTrackRoleSelect={enableDualTrackRoleSelect}
      form={form}
      locations={[{ value: 'TWN', text: '台灣' }]}
      industries={[{ subject_group: 'TECH', subject: '科技與軟體' }]}
      haveTopicGroups={SAMPLE_GROUPS}
      haveSkillGroups={SAMPLE_GROUPS}
      wantPositionGroups={SAMPLE_GROUPS}
      wantSkillGroups={SAMPLE_GROUPS}
      wantTopicGroups={SAMPLE_GROUPS}
      directionMap={directionMap}
      onDirectionMapChange={setDirectionMap}
      onAvatarFileChange={() => {}}
      onSelectPresetAvatar={(code) => form.setValue('avatar', code)}
      isSubmitting={false}
      onSubmit={async () => {}}
    />
  );
}

const meta: Meta<typeof OnboardingUI> = {
  title: '頁面(Pages)/Auth/SinglePageOnboarding',
  component: OnboardingUI,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof OnboardingUI>;

export const MenteeMode: Story = {
  name: '發版預設 Mentee 單頁引導 (#970)',
  render: () => (
    <OnboardingStoryDemo
      initialRole="mentee"
      enableDualTrackRoleSelect={false}
    />
  ),
};

export const DualTrackMentorModePreview: Story = {
  name: '雙軌預覽 Mentor 模式 (#971)',
  render: () => (
    <OnboardingStoryDemo
      initialRole="mentor"
      enableDualTrackRoleSelect={true}
    />
  ),
};
