import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import { REAL_FILTER_OPTIONS } from './__mocks__/filterMockData';
import MentorFilterDropdown, {
  type FilterOptions,
  type SelectFilters,
} from './MentorFilterDropdown';

const meta: Meta<typeof MentorFilterDropdown> = {
  title: '業務模組元件/篩選器(Filter)/MentorFilterDropdown',
  component: MentorFilterDropdown,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '導師池進階篩選下拉選單，內建各維度單選控制項（技能、主題、產業），於開啟/關閉轉移時自動重置未套用草稿，且開啟選單、套用篩選（`mentor_pool_filter_apply`，動態附帶 `filter_type` 與 `filter_value`）與清除全部皆具備宣告式 GA4 埋點。',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof MentorFilterDropdown>;

const LONG_SCROLLABLE_FILTER_OPTIONS: FilterOptions = {
  ...REAL_FILTER_OPTIONS,
  filter_skills: {
    name: '技能',
    options: [
      ...REAL_FILTER_OPTIONS.filter_skills.options,
      { label: 'Go / 微服務架構', value: 'golang_microservices' },
      { label: 'Java / Spring Boot', value: 'java_spring' },
      { label: 'Kubernetes / 雲端原生', value: 'k8s_cloud_native' },
      { label: 'AWS / 雲端基礎架構', value: 'aws_infra' },
      { label: 'iOS / Swift 開發', value: 'ios_swift' },
      { label: 'Android / Kotlin 開發', value: 'android_kotlin' },
      { label: '資料工程 / Data Pipeline', value: 'data_engineering' },
      { label: '機器學習系統 (MLOps)', value: 'mlops' },
    ],
  },
};

const MentorFilterDropdownDemo = ({
  initialFilters = {},
  customFilterOptions = REAL_FILTER_OPTIONS,
}: {
  initialFilters?: SelectFilters;
  customFilterOptions?: FilterOptions;
}) => {
  const [selectedFilters, setSelectedFilters] =
    useState<SelectFilters>(initialFilters);

  return (
    <div className="border-background-border bg-background-bottom flex min-h-[150px] w-[360px] flex-col justify-between rounded-lg border p-6">
      <div>
        <h4 className="text-text-primary mb-3 text-sm font-semibold">
          導師篩選下拉選單
        </h4>
        <MentorFilterDropdown
          filterOptions={customFilterOptions}
          selectOptions={selectedFilters}
          onChange={setSelectedFilters}
        />
      </div>

      <div className="border-background-border bg-background-white mt-6 rounded-md border p-3 text-xs">
        <p className="text-text-secondary mb-1 font-bold">
          當前已套用之篩選條件：
        </p>
        {Object.keys(selectedFilters).length === 0 ? (
          <span className="text-text-tertiary">無任何篩選條件</span>
        ) : (
          <ul className="text-text-secondary list-disc space-y-1 pl-4">
            {Object.entries(selectedFilters).map(([key, filter]) => (
              <li key={key}>
                <span className="text-logoBlue font-semibold">
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

export const AllDimensionsSelected: Story = {
  render: () => (
    <MentorFilterDropdownDemo
      initialFilters={{
        filter_skills: { name: '技能', value: 'typescript' },
        filter_topics: { name: '主題', value: 'career_planning' },
        filter_industries: { name: '產業', value: 'fintech' },
      }}
    />
  ),
};

export const LongOptionsScrollable: Story = {
  render: () => (
    <MentorFilterDropdownDemo
      customFilterOptions={LONG_SCROLLABLE_FILTER_OPTIONS}
      initialFilters={{
        filter_skills: { name: '技能', value: 'react_nextjs' },
      }}
    />
  ),
};
