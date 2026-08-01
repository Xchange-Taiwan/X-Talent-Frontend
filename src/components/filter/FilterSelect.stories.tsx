import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import { REAL_FILTER_OPTIONS } from './__mocks__/filterMockData';
import FilterSelect from './FilterSelect';

const meta: Meta<typeof FilterSelect> = {
  title: '業務模組元件/篩選器(Filter)/FilterSelect',
  component: FilterSelect,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof FilterSelect>;

const FilterSelectDemo = ({
  name,
  options,
  initialValue = '',
}: {
  name: string;
  options: { label: string; value: string }[];
  initialValue?: string;
}) => {
  const [value, setValue] = useState(initialValue);
  return (
    <div className="w-[300px] rounded-lg border border-background-border bg-background-white p-4">
      <FilterSelect
        name={name}
        value={value}
        options={options}
        onChange={setValue}
      />
      <div className="mt-4 text-xs text-text-tertiary">
        當前選取值:{' '}
        <span className="rounded bg-background-bottom-secondary px-1 py-0.5 font-mono">
          {value || '無'}
        </span>
      </div>
    </div>
  );
};

export const Skill: Story = {
  render: () => (
    <FilterSelectDemo
      name="技能"
      options={REAL_FILTER_OPTIONS.filter_skills.options}
    />
  ),
};

export const Topic: Story = {
  render: () => (
    <FilterSelectDemo
      name="主題"
      options={REAL_FILTER_OPTIONS.filter_topics.options}
    />
  ),
};

export const Industry: Story = {
  render: () => (
    <FilterSelectDemo
      name="產業"
      options={REAL_FILTER_OPTIONS.filter_industries.options}
    />
  ),
};
