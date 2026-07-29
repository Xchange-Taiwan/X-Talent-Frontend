import type { Meta, StoryObj } from '@storybook/nextjs';
import * as React from 'react';

import { step5Schema } from '@/schemas/onboarding';
import { mockTopicGroups } from '@/test/fixtures/tagCatalog';

import { OnboardingStepDemoWrapper } from './OnboardingStoryWrapper';
import { TopicsToDiscuss } from './TopicsToDiscuss';

const meta: Meta<typeof TopicsToDiscuss> = {
  title: 'Components/Onboarding/Steps/TopicsToDiscuss',
  component: TopicsToDiscuss,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TopicsToDiscuss>;

interface DemoProps {
  initialValue?: string[];
  maxSelected?: number;
}

const TopicsToDiscussDemo: React.FC<DemoProps> = ({
  initialValue = [],
  maxSelected = 10,
}) => {
  return (
    <OnboardingStepDemoWrapper
      schema={step5Schema}
      fieldName="want_topic"
      defaultValues={{ want_topic: initialValue }}
    >
      {(form) => (
        <TopicsToDiscuss
          form={form}
          wantTopicGroups={mockTopicGroups}
          maxSelected={maxSelected}
        />
      )}
    </OnboardingStepDemoWrapper>
  );
};

export const EmptySelection: Story = {
  name: 'Empty Selection (空選狀態)',
  render: () => <TopicsToDiscussDemo maxSelected={10} />,
};

export const PartialSelection: Story = {
  name: 'Partial Selection (部分選取)',
  render: () => (
    <TopicsToDiscussDemo
      initialValue={['career_planning', 'resume_review']}
      maxSelected={10}
    />
  ),
};

export const MaxSelectionReached: Story = {
  name: 'Max Selection Reached (達選取上限)',
  render: () => (
    <TopicsToDiscussDemo
      initialValue={['career_planning', 'resume_review', 'mock_interview']}
      maxSelected={3}
    />
  ),
};
