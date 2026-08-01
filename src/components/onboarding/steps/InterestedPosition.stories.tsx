import type { Meta, StoryObj } from '@storybook/nextjs';
import * as React from 'react';

import { step3Schema } from '@/schemas/onboarding';
import { mockPositionGroups } from '@/test/fixtures/tagCatalog';

import { InterestedPosition } from './InterestedPosition';
import { OnboardingStepDemoWrapper } from './OnboardingStoryWrapper';

const meta: Meta<typeof InterestedPosition> = {
  title: '業務模組元件/新手引導(Onboarding)/Steps/InterestedPosition',
  component: InterestedPosition,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof InterestedPosition>;

interface DemoProps {
  initialValue?: string[];
  maxSelected?: number;
}

const InterestedPositionDemo: React.FC<DemoProps> = ({
  initialValue = [],
  maxSelected = 10,
}) => {
  return (
    <OnboardingStepDemoWrapper
      schema={step3Schema}
      fieldName="want_position"
      defaultValues={{ want_position: initialValue }}
    >
      {(form) => (
        <InterestedPosition
          form={form}
          wantPositionGroups={mockPositionGroups}
          maxSelected={maxSelected}
        />
      )}
    </OnboardingStepDemoWrapper>
  );
};

export const EmptySelection: Story = {
  name: 'Empty Selection (空選狀態)',
  render: () => <InterestedPositionDemo maxSelected={10} />,
};

export const PartialSelection: Story = {
  name: 'Partial Selection (部分選取)',
  render: () => (
    <InterestedPositionDemo
      initialValue={['frontend_developer', 'uiux_designer']}
      maxSelected={10}
    />
  ),
};

export const MaxSelectionReached: Story = {
  name: 'Max Selection Reached (達選取上限)',
  render: () => (
    <InterestedPositionDemo
      initialValue={['frontend_developer', 'uiux_designer']}
      maxSelected={2}
    />
  ),
};
