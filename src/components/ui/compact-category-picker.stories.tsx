import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import type { Category } from './category-multi-select';
import { CompactCategoryPicker } from './compact-category-picker';

const SAMPLE_CATEGORIES: Category[] = [
  {
    key: 'career',
    label: '求職技能發展',
    options: [
      { value: 'resume_check', label: '履歷健檢' },
      { value: 'portfolio_review', label: '作品集檢視' },
      { value: 'mock_interview', label: '模擬面試' },
    ],
  },
  {
    key: 'workplace',
    label: '職場實戰工作',
    options: [
      { value: 'career_planning', label: '職涯規劃' },
      { value: 'cross_team', label: '跨部門協作' },
    ],
  },
];

function ControlledDemo({
  initialValue,
  addLabel,
  maxSelected = 10,
  singleSelect = false,
}: {
  initialValue: string[];
  addLabel: string;
  maxSelected?: number;
  singleSelect?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(initialValue);
  return (
    <div className="max-w-xl p-6">
      <CompactCategoryPicker
        categories={SAMPLE_CATEGORIES}
        value={selected}
        onChange={setSelected}
        addLabel={addLabel}
        maxSelected={maxSelected}
        singleSelect={singleSelect}
        searchPlaceholder="搜尋項目"
      />
    </div>
  );
}

const meta: Meta<typeof CompactCategoryPicker> = {
  title: 'UI/CompactCategoryPicker',
  component: CompactCategoryPicker,
};

export default meta;
type Story = StoryObj<typeof CompactCategoryPicker>;

export const SelectedServices: Story = {
  render: () => (
    <ControlledDemo
      initialValue={['resume_check', 'portfolio_review', 'career_planning']}
      addLabel="新增服務"
    />
  ),
};

export const EmptyState: Story = {
  render: () => <ControlledDemo initialValue={[]} addLabel="新增技能" />,
};

export const SingleSelectDirection: Story = {
  render: () => (
    <ControlledDemo
      initialValue={['career_planning']}
      addLabel="新增職位"
      maxSelected={1}
      singleSelect
    />
  ),
};
