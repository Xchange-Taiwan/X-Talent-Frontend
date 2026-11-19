import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';

import type { MenteeDirectionReadGroup } from '@/lib/profile/menteeDirectionView';

import { MenteeWatchedPositionsCard } from './MenteeWatchedPositionsCard';

const meta: Meta<typeof MenteeWatchedPositionsCard> = {
  title: '業務模組元件/個人檔案(Profile)/MenteeWatchedPositionsCard',
  component: MenteeWatchedPositionsCard,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MenteeWatchedPositionsCard>;

const sampleGroups: MenteeDirectionReadGroup[] = [
  {
    key: 'uiux',
    label: '產品設計／UIUX',
    skills: [
      { subject_group: 'ux_research', subject: 'UX Research' },
      { subject_group: 'design_system', subject: '設計系統' },
    ],
    topics: [
      { subject_group: 'portfolio', subject: '作品集檢視' },
      { subject_group: 'career', subject: '職涯規劃' },
    ],
    totalCount: 4,
  },
  {
    key: 'fe',
    label: '前端工程',
    skills: [{ subject_group: 'react', subject: 'React' }],
    topics: [{ subject_group: 'interview', subject: '模擬面試' }],
    totalCount: 2,
  },
];

export const WithDirections: Story = {
  render: () => {
    const [active, setActive] = useState<string>('uiux');
    return (
      <div className="max-w-[414px] p-4">
        <MenteeWatchedPositionsCard
          groups={sampleGroups}
          activeDirection={active}
          onSelectDirection={setActive}
        />
      </div>
    );
  },
};

export const Empty: Story = {
  args: {
    groups: [],
  },
};
