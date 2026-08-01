import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import { CategoryMultiSelect } from './category-multi-select';

const meta: Meta<typeof CategoryMultiSelect> = {
  title: '基礎/原子元件/CategoryMultiSelect',
  component: CategoryMultiSelect,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CategoryMultiSelect>;

const CATEGORIES = [
  {
    key: 'position',
    label: '專業角色 (Positions)',
    options: [
      { value: 'frontend', label: '前端工程師 (Frontend)' },
      { value: 'backend', label: '後端工程師 (Backend)' },
      { value: 'pm', label: '產品經理 (Product Manager)' },
    ],
  },
  {
    key: 'skill',
    label: '專業技能 (Skills)',
    options: [
      { value: 'react', label: 'React' },
      { value: 'typescript', label: 'TypeScript' },
      { value: 'node', label: 'Node.js' },
    ],
  },
  {
    key: 'topic',
    label: '諮詢主題 (Topics)',
    options: [
      { value: 'career', label: '職涯規劃 (Career Planning)' },
      { value: 'resume', label: '履歷健檢 (Resume Review)' },
      { value: 'mock-interview', label: '模擬面試 (Mock Interview)' },
    ],
  },
];

const CategoryMultiSelectDemo = (
  args: React.ComponentProps<typeof CategoryMultiSelect>
) => {
  const [selected, setSelected] = useState<string[]>(['frontend']);
  return (
    <div className="max-w-md">
      <CategoryMultiSelect
        {...args}
        categories={CATEGORIES}
        value={selected}
        onChange={setSelected}
      />
      <div className="mt-4 text-sm text-text-tertiary">
        已選取: {selected.join(', ') || '無'}
      </div>
    </div>
  );
};

const CategoryMultiSelectFlatDemo = (
  args: React.ComponentProps<typeof CategoryMultiSelect>
) => {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <div className="max-w-md">
      <CategoryMultiSelect
        {...args}
        flat
        categories={CATEGORIES}
        value={selected}
        onChange={setSelected}
      />
    </div>
  );
};

// 1. Basic Interactive Demo
export const Default: Story = {
  render: (args) => <CategoryMultiSelectDemo {...args} />,
};

// 2. Flat List Demo
export const FlatList: Story = {
  render: (args) => <CategoryMultiSelectFlatDemo {...args} />,
};
