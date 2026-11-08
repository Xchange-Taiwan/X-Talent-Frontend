import type { Meta, StoryObj } from '@storybook/nextjs';

import { JoinMeetButton } from './JoinMeetButton';

const meta: Meta<typeof JoinMeetButton> = {
  title: '業務模組元件/預約管理(Reservation)/JoinMeetButton',
  component: JoinMeetButton,
  tags: ['autodocs'],
  args: {
    onClick: () => {},
    isPending: false,
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<typeof JoinMeetButton>;

export const Default: Story = {};

export const PendingState: Story = {
  args: {
    isPending: true,
  },
};

export const DisabledState: Story = {
  args: {
    disabled: true,
  },
};
