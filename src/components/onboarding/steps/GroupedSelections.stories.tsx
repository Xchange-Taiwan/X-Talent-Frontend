import type { Meta, StoryObj } from '@storybook/nextjs';
import * as React from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { tagGroupsToCategories } from '@/lib/profile/categoryGrouping';
import { cn } from '@/lib/utils';
import { mockPositionGroups } from '@/test/fixtures/tagCatalog';

import { GroupedSelections } from './GroupedSelections';

const meta: Meta<typeof GroupedSelections> = {
  title: 'Components/Onboarding/Steps/GroupedSelections',
  component: GroupedSelections,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof GroupedSelections>;

const CATEGORIES = tagGroupsToCategories(mockPositionGroups);

// Interactive Demo Wrapper
const GroupedSelectionsInteractive = ({
  initialValue = [],
  maxSelected = 3,
  ...args
}: {
  initialValue?: string[];
  maxSelected?: number;
  [key: string]: unknown;
}) => {
  const [value, setValue] = React.useState<string[]>(initialValue);

  return (
    <div className="max-w-2xl rounded-xl border p-6 shadow-sm">
      <GroupedSelections
        {...args}
        categories={CATEGORIES}
        value={value}
        onChange={setValue}
        maxSelected={maxSelected}
        layoutClass="grid grid-cols-1 gap-4 sm:grid-cols-2"
        renderItem={(opt, { checked, disabled, onToggle }) => (
          <label
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors',
              checked
                ? 'border-brand-500 bg-background-bottom'
                : 'border-background-border hover:bg-background-bottom-secondary',
              disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent'
            )}
          >
            <Checkbox
              checked={checked}
              disabled={disabled}
              onCheckedChange={onToggle}
            />
            <span className="text-base text-text-primary">{opt.label}</span>
          </label>
        )}
      />
      <div className="mt-4 border-t pt-4 text-sm text-text-tertiary">
        <strong>當前狀態：</strong>已選取 {value.length} 個項目 (
        {value
          .map(
            (v) =>
              CATEGORIES.flatMap((c) => c.options).find((o) => o.value === v)
                ?.label
          )
          .filter(Boolean)
          .join(', ') || '無'}
        )
      </div>
    </div>
  );
};

// 1. Interactive Demo (Empty Selection State)
export const Default: Story = {
  render: (args) => <GroupedSelectionsInteractive {...args} maxSelected={3} />,
};

// 2. Fully Selected State (maxSelected = 2, pre-selected 2 items)
export const FullySelected: Story = {
  render: (args) => (
    <GroupedSelectionsInteractive
      {...args}
      initialValue={['frontend_developer', 'backend_developer']}
      maxSelected={2}
    />
  ),
};

// 3. Static Demonstration of empty groups and state
export const StaticEmptyAndPreselected: Story = {
  args: {
    categories: CATEGORIES,
    value: ['frontend_developer'],
    maxSelected: 3,
    layoutClass: 'grid grid-cols-1 gap-4 sm:grid-cols-2',
    renderItem: (opt, { checked, disabled, onToggle }) => (
      <label
        className={cn(
          'flex cursor-pointer items-center gap-3 rounded-xl border p-3',
          checked
            ? 'border-brand-500 bg-background-bottom'
            : 'border-background-border',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <Checkbox
          checked={checked}
          disabled={disabled}
          onCheckedChange={onToggle}
        />
        <span className="text-base text-text-primary">{opt.label}</span>
      </label>
    ),
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl rounded-xl border p-6 shadow-sm">
        <Story />
      </div>
    ),
  ],
};
