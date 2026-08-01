import type { Meta, StoryObj } from '@storybook/nextjs';

import { HamburgerMenu } from './HamburgerMenu';

const meta: Meta<typeof HamburgerMenu> = {
  title: 'Layout/Header/HamburgerMenu',
  component: HamburgerMenu,
  tags: ['autodocs'],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
  args: {
    isLoggedIn: false,
    isMentor: false,
    userId: undefined,
    isResolvingUser: false,
  },
};

export default meta;
type Story = StoryObj<typeof HamburgerMenu>;

// 1. Guest Session
export const Guest: Story = {
  args: {
    isLoggedIn: false,
    isMentor: false,
    userId: undefined,
    isResolvingUser: false,
  },
};

// 2. Mentor Session
export const MentorSession: Story = {
  args: {
    isLoggedIn: true,
    isMentor: true,
    userId: 'mentor-123',
    isResolvingUser: false,
  },
};

// 3. Mentee Session
export const MenteeSession: Story = {
  args: {
    isLoggedIn: true,
    isMentor: false,
    userId: 'mentee-456',
    isResolvingUser: false,
  },
};

// 4. Unresolved / Loading State
export const UnresolvedState: Story = {
  args: {
    isLoggedIn: true,
    isMentor: false,
    userId: undefined,
    isResolvingUser: true,
  },
};
