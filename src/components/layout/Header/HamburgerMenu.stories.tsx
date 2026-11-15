import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { useHeaderNavigation } from '@/hooks/layout/useHeaderNavigation';
import type { ResolvedIdentity } from '@/lib/auth/sessionHint';
import { GUEST_IDENTITY, UNKNOWN_IDENTITY } from '@/test/mocks/identity';

import { HamburgerMenu } from './HamburgerMenu';

type HamburgerMenuStoryArgs = {
  identity: ResolvedIdentity;
};

function HamburgerMenuStoryHarness({
  identity,
}: HamburgerMenuStoryArgs): JSX.Element {
  const navigation = useHeaderNavigation({ identity });
  return <HamburgerMenu navigation={navigation} />;
}

const meta: Meta<typeof HamburgerMenuStoryHarness> = {
  title: '佈局元件/Header/HamburgerMenu',
  component: HamburgerMenuStoryHarness,
  tags: ['autodocs'],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
    docs: {
      description: {
        component:
          '行動版訪客漢堡選單，由 `useHeaderNavigation` 提供宣告式導覽與 `aria-current="page"` 狀態，並以 `<AuthHintGate>` 控制預渲染顯示。',
      },
    },
  },
  args: {
    identity: GUEST_IDENTITY,
  },
};

export default meta;
type Story = StoryObj<typeof HamburgerMenuStoryHarness>;

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

// 3. Active About Route
export const AboutActiveRoute: Story = {
  args: {
    identity: GUEST_IDENTITY,
  },
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/about',
      },
    },
  },
};
