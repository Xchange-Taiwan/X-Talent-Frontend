import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import { CategoryMultiSelect } from './category-multi-select';

const meta: Meta<typeof CategoryMultiSelect> = {
  title: 'Components/UI/CategoryMultiSelect',
  component: CategoryMultiSelect,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CategoryMultiSelect>;

const CATEGORIES = [
  {
    key: 'tech',
    label: '技術開發',
    options: [
      { value: 'frontend', label: '前端開發 (Frontend)' },
      { value: 'backend', label: '後端開發 (Backend)' },
      { value: 'devops', label: '雲端運維 (DevOps)' },
    ],
  },
  {
    key: 'design',
    label: '設計與行銷',
    options: [
      { value: 'uiux', label: 'UI/UX 設計' },
      { value: 'marketing', label: '社群行銷' },
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
