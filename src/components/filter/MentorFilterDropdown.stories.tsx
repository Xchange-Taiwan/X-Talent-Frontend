import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import MentorFilterDropdown, {
  FilterOptions,
  SelectFilters,
} from './MentorFilterDropdown';

const meta: Meta<typeof MentorFilterDropdown> = {
  title: 'Components/Filter/MentorFilterDropdown',
  component: MentorFilterDropdown,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MentorFilterDropdown>;

const REAL_FILTER_OPTIONS: FilterOptions = {
  filter_skills: {
    name: '技能',
    options: [
      { label: 'React / Next.js', value: 'react_nextjs' },
      { label: 'Node.js / Express', value: 'nodejs' },
      { label: 'TypeScript', value: 'typescript' },
      { label: 'UI / UX 設計', value: 'ui_ux_design' },
      { label: '產品規劃', value: 'product_planning' },
      { label: 'Python / AI開發', value: 'python_ai' },
    ],
  },
  filter_topics: {
    name: '主題',
    options: [
      { label: '履歷健檢與優化', value: 'resume_review' },
      { label: '模擬面試與回饋', value: 'mock_interview' },
      { label: '職涯規劃與轉職諮詢', value: 'career_planning' },
      { label: '海外求職與工作分享', value: 'overseas_job' },
      { label: '跨領域轉職心路歷程', value: 'cross_domain' },
    ],
  },
  filter_industries: {
    name: '產業',
    options: [
      { label: '軟體與網路 (Software & Internet)', value: 'software_internet' },
      { label: '金融科技 (FinTech)', value: 'fintech' },
      { label: '電子商務 (E-commerce)', value: 'ecommerce' },
      { label: '半導體與硬體 (Semiconductor)', value: 'semiconductor' },
      { label: '行銷與廣告 (Marketing & Ads)', value: 'marketing_ads' },
    ],
  },
};

const MentorFilterDropdownDemo = ({
  initialFilters = {},
}: {
  initialFilters?: SelectFilters;
}) => {
  const [selectedFilters, setSelectedFilters] =
    useState<SelectFilters>(initialFilters);

  return (
    <div className="flex min-h-[150px] w-[360px] flex-col justify-between rounded-lg border border-background-border bg-background-bottom p-6">
      <div>
        <h4 className="mb-3 text-sm font-semibold text-text-primary">
          導師篩選下拉選單
        </h4>
        <MentorFilterDropdown
          filterOptions={REAL_FILTER_OPTIONS}
          selectOptions={selectedFilters}
          onChange={setSelectedFilters}
        />
      </div>

      <div className="mt-6 rounded-md border border-background-border bg-background-white p-3 text-xs">
        <p className="mb-1 font-bold text-text-secondary">
          當前已套用之篩選條件：
        </p>
        {Object.keys(selectedFilters).length === 0 ? (
          <span className="text-text-tertiary">無任何篩選條件</span>
        ) : (
          <ul className="list-disc space-y-1 pl-4 text-text-secondary">
            {Object.entries(selectedFilters).map(([key, filter]) => (
              <li key={key}>
                <span className="font-semibold text-logoBlue">
                  {filter.name}
                </span>
                : {filter.value}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export const Default: Story = {
  render: () => <MentorFilterDropdownDemo />,
};

export const PreSelected: Story = {
  render: () => (
    <MentorFilterDropdownDemo
      initialFilters={{
        filter_skills: { name: '技能', value: 'react_nextjs' },
        filter_industries: { name: '產業', value: 'software_internet' },
      }}
    />
  ),
};
