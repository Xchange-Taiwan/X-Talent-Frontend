import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import { REAL_FILTER_OPTIONS } from './__mocks__/filterMockData';
import MentorFilterDropdown, { SelectFilters } from './MentorFilterDropdown';

const meta: Meta<typeof MentorFilterDropdown> = {
  title: '業務模組元件/篩選器(Filter)/MentorFilterDropdown',
  component: MentorFilterDropdown,
  tags: ['autodocs'],
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
