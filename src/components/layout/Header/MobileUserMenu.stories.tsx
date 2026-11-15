import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { authenticatedIdentity } from '@/test/mocks/identity';

import { MobileUserMenu } from './MobileUserMenu';

const meta: Meta<typeof MobileUserMenu> = {
  title: '佈局元件/Header/MobileUserMenu',
  component: MobileUserMenu,
  tags: ['autodocs'],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
    docs: {
      description: {
        component:
          '行動版已登入會員側欄選單，導覽與個人帳務操作項目（含我的預約、我的收藏與登出）皆具備與桌機版對齊之 `data-analytics-click`（`location="mobile_user_menu"`），且嚴格不攜帶任何 PII。',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="bg-background-bottom flex min-h-[300px] justify-end p-8">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MobileUserMenu>;

const mockMentorUser = {
  id: 'mentor-123',
  email: 'mentor@xchange.tw',
  name: '陳導師 (Mentor)',
  avatar:
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  onBoarding: false,
  isMentor: true,
  jobTitle: 'Principal Product Manager',
  company: 'Google',
  personalLinks: [
    { platform: 'linkedin', url: 'https://linkedin.com/in/username' },
    { platform: 'github', url: 'https://github.com/username' },
  ],
};

const mockMenteeUser = {
  id: 'mentee-456',
  email: 'mentee@xchange.tw',
  name: '林學員 (Mentee)',
  avatar:
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
  onBoarding: true,
  isMentor: false,
  jobTitle: 'UI/UX Design Student',
  company: 'National Taiwan University',
  personalLinks: [],
};

// 1. Mentor Session
export const MentorSession: Story = {
  args: {
    identity: authenticatedIdentity('mentor-123', { isMentor: true }),
    user: mockMentorUser,
  },
};

// 2. Mentee Session
export const MenteeSession: Story = {
  args: {
    identity: authenticatedIdentity('mentee-456', { isMentor: false }),
    user: mockMenteeUser,
  },
};

// 3. User with No Name Fallback
export const AnonymousSession: Story = {
  args: {
    identity: authenticatedIdentity('anon-789', { isMentor: false }),
    user: {
      id: 'anon-789',
      email: 'anon@xchange.tw',
      name: undefined,
      avatar: undefined,
      onBoarding: true,
      isMentor: false,
    },
  },
};
