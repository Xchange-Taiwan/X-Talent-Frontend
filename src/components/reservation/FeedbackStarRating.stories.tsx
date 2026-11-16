import type { Meta, StoryObj } from '@storybook/nextjs';

import { FeedbackStarRating } from './FeedbackStarRating';

const meta: Meta<typeof FeedbackStarRating> = {
  title: '業務模組元件/預約管理(Reservation)/FeedbackStarRating',
  component: FeedbackStarRating,
  tags: ['autodocs'],
  args: {
    value: 10,
    onChange: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof FeedbackStarRating>;

export const DefaultFullScore: Story = {
  args: {
    value: 10,
  },
};

export const PartialScoreEight: Story = {
  args: {
    value: 8,
  },
};

export const DisabledState: Story = {
  args: {
    value: 9,
    disabled: true,
  },
};
