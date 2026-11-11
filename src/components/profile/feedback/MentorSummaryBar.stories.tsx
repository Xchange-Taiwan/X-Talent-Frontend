import type { Meta, StoryObj } from '@storybook/nextjs';

import { MentorSummaryBar } from './MentorSummaryBar';

const meta: Meta<typeof MentorSummaryBar> = {
  title: '業務模組元件/個人檔案(Profile)/Feedback/MentorSummaryBar',
  component: MentorSummaryBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof MentorSummaryBar>;

export const FourColumnsWithRatings: Story = {
  args: {
    ratingAverage: 8.5,
    ratingCount: 12,
    completedMeetingCount: 128,
    yearsOfExperience: '5~10 年',
    location: '台灣',
    industries: [
      { subject_group: 'software', subject: '軟體及網路相關業' },
      { subject_group: 'design', subject: '設計及創意相關業' },
    ],
  },
};

export const ThreeColumnsZeroRatings: Story = {
  args: {
    ratingAverage: null,
    ratingCount: 0,
    completedMeetingCount: 128,
    yearsOfExperience: '5~10 年',
    location: '台灣',
    industries: [
      { subject_group: 'software', subject: '軟體及網路相關業' },
      { subject_group: 'design', subject: '設計及創意相關業' },
    ],
  },
};

export const NewMentorZeroSessionsAndZeroRatings: Story = {
  args: {
    ratingAverage: null,
    ratingCount: 0,
    completedMeetingCount: 0,
    yearsOfExperience: '3~5 年',
    location: '台灣',
    industries: [{ subject_group: 'software', subject: '軟體及網路相關業' }],
  },
};
