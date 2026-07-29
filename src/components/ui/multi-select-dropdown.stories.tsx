import type { Meta, StoryObj } from '@storybook/nextjs';
import { Briefcase, Code, Compass, Globe } from 'lucide-react';
import React, { useState } from 'react';

import MultiSelectDropdown from './multi-select-dropdown';

const meta: Meta<typeof MultiSelectDropdown> = {
  title: 'Components/UI/MultiSelectDropdown',
  component: MultiSelectDropdown,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MultiSelectDropdown>;

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
];

const DropdownWrapper = () => {
  const [selected, setSelected] = useState<string[]>(['frontend']);

  const handleToggleOption = (val: string) => {
    setSelected((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  };

  const handleToggleAll = () => {
    if (selected.length === OPTIONS.length) {
      setSelected([]);
    } else {
      setSelected(OPTIONS.map((o) => o.value));
    }
  };

  return (
    <div className="max-w-md rounded-lg border p-2 shadow-sm">
      <MultiSelectDropdown
        options={OPTIONS}
        selectedValues={selected}
        onInputKeyDown={() => {}}
        onToggleOption={handleToggleOption}
        onToggleAll={handleToggleAll}
        onClear={() => setSelected([])}
        onClose={() => alert('Closed dropdown')}
      />
    </div>
  );
};

export const Default: Story = {
  render: () => <DropdownWrapper />,
};
