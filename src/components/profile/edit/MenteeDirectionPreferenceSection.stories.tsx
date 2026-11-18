import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import type { Category } from '@/components/ui/category-multi-select';
import type { ProfileFormContext } from '@/hooks/user/profile/useProfileEditorSession';
import {
  hydrateMenteeDirectionMap,
  type MenteeDirectionMap,
} from '@/lib/profile/menteeDirectionPreference';
import {
  createProfileFormSchema,
  defaultValues,
} from '@/schemas/profileSchema';

import { MenteeDirectionPreferenceSection } from './MenteeDirectionPreferenceSection';
import { ProfileStoryWrapper } from './ProfileStoryWrapper';

const mockPositions: Category[] = [
  {
    key: 'software_dev',
    label: '軟體開發',
    options: [
      { value: 'frontend_engineer', label: '前端工程師' },
      { value: 'backend_engineer', label: '後端工程師' },
      { value: 'fullstack_engineer', label: '全端工程師' },
    ],
  },
  {
    key: 'product_design',
    label: '產品設計',
    options: [
      { value: 'product_manager', label: '產品經理' },
      { value: 'uiux_designer', label: 'UI/UX 設計師' },
    ],
  },
];

const mockSkills: Category[] = [
  {
    key: 'software_dev',
    label: '軟體開發',
    options: [
      { value: 'react', label: 'React' },
      { value: 'typescript', label: 'TypeScript' },
      { value: 'nextjs', label: 'Next.js' },
      { value: 'go', label: 'Go' },
      { value: 'python', label: 'Python' },
    ],
  },
];

const mockTopics: Category[] = [
  {
    key: 'career_skill_dev',
    label: '求職技能發展',
    options: [
      { value: 'portfolio_guidance', label: '求職作品指導' },
      { value: 'interview_skills', label: '面試說話技巧' },
      { value: 'career_transition', label: '未來轉職規劃' },
    ],
  },
];

const meta: Meta<typeof MenteeDirectionPreferenceSection> = {
  title: '業務模組元件/個人檔案(Profile)/Edit/MenteeDirectionPreferenceSection',
  component: MenteeDirectionPreferenceSection,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof MenteeDirectionPreferenceSection>;

function DirectionPreferenceDemo({
  initialPositions,
  initialSkills,
  initialTopics,
}: {
  initialPositions: string[];
  initialSkills: string[];
  initialTopics: string[];
}) {
  const [directionMap, setDirectionMap] = useState<MenteeDirectionMap>(() =>
    hydrateMenteeDirectionMap({
      positions: initialPositions,
      flatSkills: initialSkills,
      flatTopics: initialTopics,
    })
  );

  return (
    <ProfileStoryWrapper
      schema={createProfileFormSchema(false)}
      defaultValues={{
        ...defaultValues,
        want_position: initialPositions,
        want_skill: initialSkills,
        want_topic: initialTopics,
      }}
    >
      {(form: ProfileFormContext) => (
        <MenteeDirectionPreferenceSection
          form={form}
          wantPositionCategories={mockPositions}
          wantSkillCategories={mockSkills}
          wantTopicCategories={mockTopics}
          directionMap={directionMap}
          onDirectionMapChange={setDirectionMap}
        />
      )}
    </ProfileStoryWrapper>
  );
}

export const TwoDirectionsFilled: Story = {
  name: '已選擇多個職位方向（分頁獨立保留技能與主題）',
  render: () => (
    <DirectionPreferenceDemo
      initialPositions={['frontend_engineer', 'backend_engineer']}
      initialSkills={['react', 'typescript']}
      initialTopics={['portfolio_guidance', 'interview_skills']}
    />
  ),
};

export const EmptyDirections: Story = {
  name: '尚未選擇職位方向（顯示引導提示）',
  render: () => (
    <DirectionPreferenceDemo
      initialPositions={[]}
      initialSkills={[]}
      initialTopics={[]}
    />
  ),
};
