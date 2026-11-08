import type { Meta, StoryObj } from '@storybook/nextjs';

import MentorGridSkeleton from './MentorGridSkeleton';

const meta: Meta<typeof MentorGridSkeleton> = {
  title: '業務模組元件/導師池(MentorPool)/MentorGridSkeleton',
  component: MentorGridSkeleton,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof MentorGridSkeleton>;

export const Default: Story = {};
