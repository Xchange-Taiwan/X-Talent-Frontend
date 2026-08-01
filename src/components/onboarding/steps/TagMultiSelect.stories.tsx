import { zodResolver } from '@hookform/resolvers/zod';
import type { Meta, StoryObj } from '@storybook/nextjs';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { Form } from '@/components/ui/form';
import { mockSkillGroups } from '@/test/fixtures/tagCatalog';

import { TagMultiSelect } from './TagMultiSelect';

const meta: Meta<typeof TagMultiSelect> = {
  title: '業務模組元件/新手引導(Onboarding)/Steps/TagMultiSelect',
  component: TagMultiSelect,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TagMultiSelect>;

// Validation schema for testing and demonstration in Storybook
const testSchema = z.object({
  skills: z
    .array(z.string())
    .min(1, '請至少選擇一個技能')
    .max(3, '最多選擇 3 個項目'),
});

type FormValues = z.infer<typeof testSchema>;

interface TagMultiSelectDemoProps {
  initialValue?: string[];
  maxSelected?: number;
  groups?: typeof mockSkillGroups;
}

const TagMultiSelectDemo: React.FC<TagMultiSelectDemoProps> = ({
  initialValue = [],
  maxSelected = 3,
  groups = mockSkillGroups,
}) => {
  const form = useForm<FormValues>({
    resolver: zodResolver(testSchema),
    defaultValues: {
      skills: initialValue,
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
          <TagMultiSelect
            control={form.control}
            name="skills"
            groups={groups}
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
                form.reset({ skills: [] });
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
          {JSON.stringify(form.watch('skills'))}
        </p>
        <p className="mt-1">
          <strong>表單驗證狀態：</strong>
          {form.formState.errors.skills ? (
            <span className="text-status-error-default">
              {form.formState.errors.skills.message}
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

// 1. Default empty state
export const Default: Story = {
  render: () => <TagMultiSelectDemo maxSelected={3} />,
};

// 2. Pre-selected state (some items selected)
export const Selected: Story = {
  render: () => (
    <TagMultiSelectDemo
      initialValue={['typescript', 'react']}
      maxSelected={3}
    />
  ),
};

// 3. Max Selection reached state (3 items selected, maxSelected is 3)
export const MaxSelectionReached: Story = {
  render: () => (
    <TagMultiSelectDemo
      initialValue={['typescript', 'react', 'nextjs']}
      maxSelected={3}
    />
  ),
};
