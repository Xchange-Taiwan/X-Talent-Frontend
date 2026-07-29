import type { Meta, StoryObj } from '@storybook/nextjs';

import { Tag } from './Tag';

const meta: Meta<typeof Tag> = {
  title: 'Components/MentorPool/Tag',
  component: Tag,
  tags: ['autodocs'],
  args: {
    label: 'UI/UX Design',
  },
};

export default meta;
type Story = StoryObj<typeof Tag>;

export const Default: Story = {
  args: {
    label: 'UI/UX Design',
  },
};

export const ShortLabel: Story = {
  args: {
    label: 'Figma',
  },
};

export const LongLabel: Story = {
  args: {
    label: 'Cross-functional Collaboration',
  },
};
