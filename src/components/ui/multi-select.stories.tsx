import type { Meta, StoryObj } from '@storybook/nextjs';
import { Briefcase, Code, Compass, Globe, Sparkles } from 'lucide-react';
import React, { useState } from 'react';

import { MultiSelect } from './multi-select';

const meta: Meta<typeof MultiSelect> = {
  title: '基礎/原子元件/MultiSelect',
  component: MultiSelect,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MultiSelect>;

const OPTIONS = [
  { label: '前端工程 (Frontend)', value: 'frontend', icon: Code },
  {
    label: '產品管理 (Product Management)',
    value: 'product-management',
    icon: Briefcase,
  },
  {
    label: '職涯規劃 (Career Planning)',
    value: 'career-planning',
    icon: Compass,
  },
  {
    label: '系統架構 (System Architecture)',
    value: 'system-architecture',
    icon: Globe,
  },
  { label: 'UI/UX 設計 (UI/UX Design)', value: 'uiux-design', icon: Sparkles },
];

const MultiSelectDemo = (args: React.ComponentProps<typeof MultiSelect>) => {
  const [selected, setSelected] = useState<string[]>(['frontend']);
  return (
    <div className="max-w-md">
      <MultiSelect
        {...args}
        options={OPTIONS}
        value={selected}
        onValueChange={setSelected}
        placeholder="請選擇您的專業領域或諮詢主題..."
      />
      <div className="text-text-tertiary mt-4 text-sm">
        目前選取值: {selected.join(', ') || '無'}
      </div>
    </div>
  );
};

// 1. Basic Interactive Demo
export const Default: Story = {
  render: (args) => <MultiSelectDemo {...args} />,
};
