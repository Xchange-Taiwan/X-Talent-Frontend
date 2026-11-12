import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import { REAL_FILTER_OPTIONS } from './__mocks__/filterMockData';
import MentorFilterDropdown, { SelectFilters } from './MentorFilterDropdown';

const meta: Meta<typeof MentorFilterDropdown> = {
  title: '業務模組元件/篩選器(Filter)/MentorFilterDropdown',
  component: MentorFilterDropdown,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '導師池進階篩選下拉選單，開啟選單、套用篩選（`mentor_pool_filter_apply`，動態附帶 `filter_type` 與 `filter_value`）與清除全部皆具備宣告式 GA4 埋點。',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof MentorFilterDropdown>;

const MentorFilterDropdownDemo = ({
  initialFilters = {},
}: {
  initialFilters?: SelectFilters;
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
          filterOptions={REAL_FILTER_OPTIONS}
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
