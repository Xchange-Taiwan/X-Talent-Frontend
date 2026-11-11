import type { Meta, StoryObj } from '@storybook/nextjs';

import { MentorStatsSummary } from './MentorStatsSummary';

const meta: Meta<typeof MentorStatsSummary> = {
  title: '業務模組元件/個人檔案(Profile)/MentorStatsSummary',
  component: MentorStatsSummary,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MentorStatsSummary>;

export const DefaultWithStats: Story = {
  args: {
    ratingAverage: 8.5,
    totalRatingCount: 12,
    completedMeetingCount: 128,
  },
};

export const CompletedMeetingsWithoutRating: Story = {
  args: {
    ratingAverage: null,
    totalRatingCount: 0,
    completedMeetingCount: 128,
  },
};

export const NewMentorEmptyState: Story = {
  args: {
    ratingAverage: null,
    totalRatingCount: 0,
    completedMeetingCount: 0,
  },
};

export const NewMentorOwnerEmptyState: Story = {
  args: {
    ratingAverage: null,
    totalRatingCount: 0,
    completedMeetingCount: 0,
    isOwnMentorProfile: true,
  },
};
