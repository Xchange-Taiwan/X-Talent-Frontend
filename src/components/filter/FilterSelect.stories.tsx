import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import FilterSelect from './FilterSelect';

const meta: Meta<typeof FilterSelect> = {
  title: 'Components/Filter/FilterSelect',
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
      options={[
        { label: 'React / Next.js', value: 'react_nextjs' },
        { label: 'Node.js / Express', value: 'nodejs' },
        { label: 'TypeScript', value: 'typescript' },
        { label: 'UI / UX 設計', value: 'ui_ux_design' },
        { label: '產品規劃', value: 'product_planning' },
        { label: 'Python / AI開發', value: 'python_ai' },
      ]}
    />
  ),
};

export const Topic: Story = {
  render: () => (
    <FilterSelectDemo
      name="主題"
      options={[
        { label: '履歷健檢與優化', value: 'resume_review' },
        { label: '模擬面試與回饋', value: 'mock_interview' },
        { label: '職涯規劃與轉職諮詢', value: 'career_planning' },
        { label: '海外求職與工作分享', value: 'overseas_job' },
        { label: '跨領域轉職心路歷程', value: 'cross_domain' },
      ]}
    />
  ),
};

export const Industry: Story = {
  render: () => (
    <FilterSelectDemo
      name="產業"
      options={[
        {
          label: '軟體與網路 (Software & Internet)',
          value: 'software_internet',
        },
        { label: '金融科技 (FinTech)', value: 'fintech' },
        { label: '電子商務 (E-commerce)', value: 'ecommerce' },
        { label: '半導體與硬體 (Semiconductor)', value: 'semiconductor' },
        { label: '行銷與廣告 (Marketing & Ads)', value: 'marketing_ads' },
      ]}
    />
  ),
};
