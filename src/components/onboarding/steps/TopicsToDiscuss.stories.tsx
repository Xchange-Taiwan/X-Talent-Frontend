import type { Meta, StoryObj } from '@storybook/nextjs';
import * as React from 'react';

import { step5Schema } from '@/schemas/onboarding';
import { mockTopicGroups } from '@/test/fixtures/tagCatalog';

import { OnboardingStoryWrapper } from './OnboardingStoryWrapper';
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
  const [submittedData, setSubmittedData] = React.useState<Record<
    string,
    string[]
  > | null>(null);

  return (
    <OnboardingStoryWrapper
      schema={step5Schema}
      defaultValues={{ want_topic: initialValue }}
    >
      {(form) => (
        <form
          onSubmit={form.handleSubmit((data) => setSubmittedData(data))}
          className="space-y-6"
        >
          <TopicsToDiscuss
            form={form}
            wantTopicGroups={mockTopicGroups}
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
                form.reset({ want_topic: [] });
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
              {JSON.stringify(form.watch('want_topic'))}
            </p>
            <p className="mt-1">
              <strong>表單驗證狀態：</strong>
              {form.formState.errors.want_topic ? (
                <span className="text-status-error-default">
                  {form.formState.errors.want_topic.message as string}
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
