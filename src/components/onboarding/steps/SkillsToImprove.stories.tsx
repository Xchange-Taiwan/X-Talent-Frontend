import { zodResolver } from '@hookform/resolvers/zod';
import type { Meta, StoryObj } from '@storybook/nextjs';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Form } from '@/components/ui/form';
import { step4Schema } from '@/schemas/onboarding';
import { mockSkillGroups } from '@/test/fixtures/tagCatalog';

import { SkillsToImprove } from './SkillsToImprove';

const meta: Meta<typeof SkillsToImprove> = {
  title: 'Components/Onboarding/Steps/SkillsToImprove',
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
  type FormValues = z.infer<typeof step4Schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      want_skill: initialValue,
    },
    mode: 'onChange',
  });

  const [submittedData, setSubmittedData] = React.useState<FormValues | null>(
    null
  );

  const onSubmit = (data: FormValues) => {
    setSubmittedData(data);
  };

  return (
    <div className="max-w-2xl rounded-xl border p-6 shadow-sm">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <SkillsToImprove
            form={form}
            wantSkillGroups={mockSkillGroups}
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
                form.reset({ want_skill: [] });
                setSubmittedData(null);
              }}
              className="rounded-lg border border-background-border px-4 py-2 text-text-secondary hover:bg-background-bottom-secondary"
            >
              重置
            </button>
          </div>
        </form>
      </Form>

      {/* Real-time Form values */}
      <div className="mt-6 border-t pt-4 text-sm text-text-tertiary">
        <p>
          <strong>表單當前數值：</strong>
          {JSON.stringify(form.watch('want_skill'))}
        </p>
        <p className="mt-1">
          <strong>表單驗證狀態：</strong>
          {form.formState.errors.want_skill ? (
            <span className="text-status-error-default">
              {form.formState.errors.want_skill.message}
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
    </div>
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
