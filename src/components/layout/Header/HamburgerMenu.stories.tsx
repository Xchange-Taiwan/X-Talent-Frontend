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
    docs: {
      description: {
        component:
          '行動版訪客漢堡選單，展開按鈕與各導覽／登入／註冊／意見回饋項目皆附帶 `data-analytics-click` 與 `data-analytics-location="mobile_menu"` 宣告式埋點。',
      },
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
