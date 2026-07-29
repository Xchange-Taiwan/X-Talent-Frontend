import type { Meta, StoryObj } from '@storybook/nextjs';
import * as React from 'react';

import { step3Schema } from '@/schemas/onboarding';
import { mockPositionGroups } from '@/test/fixtures/tagCatalog';

import { InterestedPosition } from './InterestedPosition';
import { OnboardingStoryWrapper } from './OnboardingStoryWrapper';

const meta: Meta<typeof InterestedPosition> = {
  title: 'Components/Onboarding/Steps/InterestedPosition',
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
  const [submittedData, setSubmittedData] = React.useState<Record<
    string,
    string[]
  > | null>(null);

  return (
    <OnboardingStoryWrapper
      schema={step3Schema}
      defaultValues={{ want_position: initialValue }}
    >
      {(form) => (
        <form
          onSubmit={form.handleSubmit((data) => setSubmittedData(data))}
          className="space-y-6"
        >
          <InterestedPosition
            form={form}
            wantPositionGroups={mockPositionGroups}
            maxSelected={maxSelected}
          />

          <div className="flex gap-4">
            <button
              type="submit"
              className="rounded-lg bg-brand-500 px-4 py-2 text-text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            >
              提交表單
            </button>
            <button
              type="button"
              onClick={() => {
                form.reset({ want_position: [] });
                setSubmittedData(null);
              }}
              className="rounded-lg border border-background-border px-4 py-2 text-text-secondary hover:bg-background-bottom-secondary"
            >
              重置
            </button>
          </div>

          {/* Real-time Form values */}
          <div className="mt-6 border-t pt-4 text-sm text-text-tertiary">
            <p>
              <strong>表單當前數值：</strong>
              {JSON.stringify(form.watch('want_position'))}
            </p>
            <p className="mt-1">
              <strong>表單驗證狀態：</strong>
              {form.formState.errors.want_position ? (
                <span className="text-status-error-default">
                  {form.formState.errors.want_position.message as string}
                </span>
              ) : (
                <span className="text-status-success-default">驗證通過</span>
              )}
            </p>
            {submittedData && (
              <p className="mt-2 text-brand-600">
                <strong>提交成功數據：</strong>
                {JSON.stringify(submittedData)}
              </p>
            )}
          </div>
        </form>
      )}
    </OnboardingStoryWrapper>
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
