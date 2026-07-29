import type { Meta, StoryObj } from '@storybook/nextjs';
import { Calendar, Code, Heart, Music, Sparkles } from 'lucide-react';
import React, { useState } from 'react';

import { MultiSelect } from './multi-select';

const meta: Meta<typeof MultiSelect> = {
  title: 'Components/UI/MultiSelect',
  component: MultiSelect,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MultiSelect>;

const OPTIONS = [
  { label: '程式開發 (Coding)', value: 'coding', icon: Code },
  { label: '音樂創作 (Music)', value: 'music', icon: Music },
  { label: '運動健身 (Sports)', value: 'sports', icon: Heart },
  { label: '活動策劃 (Events)', value: 'events', icon: Calendar },
  { label: 'UI/UX 設計 (Design)', value: 'design', icon: Sparkles },
];

const MultiSelectDemo = (args: React.ComponentProps<typeof MultiSelect>) => {
  const [selected, setSelected] = useState<string[]>(['coding']);
  return (
    <div className="max-w-md">
      <MultiSelect
        {...args}
        options={OPTIONS}
        value={selected}
        onValueChange={setSelected}
        placeholder="請選擇您的興趣愛好..."
      />
      <div className="mt-4 text-sm text-text-tertiary">
        目前選取值: {selected.join(', ') || '無'}
      </div>
    </div>
  );
};

// 1. Basic Interactive Demo
export const Default: Story = {
  render: (args) => <MultiSelectDemo {...args} />,
};
