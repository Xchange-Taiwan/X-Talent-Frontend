import type { Meta, StoryObj } from '@storybook/nextjs';

import { GUEST_IDENTITY, UNKNOWN_IDENTITY } from '@/test/mocks/identity';

import { HamburgerMenu } from './HamburgerMenu';

const meta: Meta<typeof HamburgerMenu> = {
  title: '佈局元件/Header/HamburgerMenu',
  component: HamburgerMenu,
  tags: ['autodocs'],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
  args: {
    identity: GUEST_IDENTITY,
  },
};

export default meta;
type Story = StoryObj<typeof HamburgerMenu>;

// 1. Guest Session
export const Guest: Story = {
  args: {
    identity: GUEST_IDENTITY,
  },
};

// 2. Pre-Hydration State
export const PreHydration: Story = {
  args: {
    identity: UNKNOWN_IDENTITY,
  },
};
