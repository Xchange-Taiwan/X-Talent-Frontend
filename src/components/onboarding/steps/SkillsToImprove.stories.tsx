import type { Meta, StoryObj } from '@storybook/nextjs';
import * as React from 'react';

import { step4Schema } from '@/schemas/onboarding';
import { mockSkillGroups } from '@/test/fixtures/tagCatalog';

import { OnboardingStepDemoWrapper } from './OnboardingStoryWrapper';
import { SkillsToImprove } from './SkillsToImprove';

const meta: Meta<typeof SkillsToImprove> = {
  title: '業務模組元件/新手引導(Onboarding)/Steps/SkillsToImprove',
  component: SkillsToImprove,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SkillsToImprove>;

interface DemoProps {
  initialValue?: string[];
  maxSelected?: number;
}

const SkillsToImproveDemo: React.FC<DemoProps> = ({
  initialValue = [],
  maxSelected = 10,
}) => {
  return (
    <OnboardingStepDemoWrapper
      schema={step4Schema}
      fieldName="want_skill"
      defaultValues={{ want_skill: initialValue }}
    >
      {(form) => (
        <SkillsToImprove
          form={form}
          wantSkillGroups={mockSkillGroups}
          maxSelected={maxSelected}
        />
      )}
    </OnboardingStepDemoWrapper>
  );
};

export const EmptySelection: Story = {
  name: 'Empty Selection (空選狀態)',
  render: () => <SkillsToImproveDemo maxSelected={10} />,
};

export const PartialSelection: Story = {
  name: 'Partial Selection (部分選取)',
  render: () => (
    <SkillsToImproveDemo
      initialValue={['javascript', 'react']}
      maxSelected={10}
    />
  ),
};

export const MaxSelectionReached: Story = {
  name: 'Max Selection Reached (達選取上限)',
  render: () => (
    <SkillsToImproveDemo
      initialValue={['javascript', 'typescript', 'react']}
      maxSelected={3}
    />
  ),
};
