import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { authenticatedIdentity } from '@/test/mocks/identity';

import { UserDropdown } from './UserDropdown';

const meta: Meta<typeof UserDropdown> = {
  title: '佈局元件/Header/UserDropdown',
  component: UserDropdown,
  tags: ['autodocs'],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
    docs: {
      description: {
        component:
          '桌機版已登入會員選單，個人頁面、分享名片、導師預約管理／成為導師、我的預約、我的收藏與登出皆具備 `data-analytics-click`（`location="user_dropdown"`），且嚴格不攜帶 `userId`、姓名或 Email。',
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
type Story = StoryObj<typeof UserDropdown>;

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

// 4. Active Favorites Route
export const FavoritesActiveRoute: Story = {
  args: {
    identity: authenticatedIdentity('mentee-456', { isMentor: false }),
    user: mockMenteeUser,
  },
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/favorites',
      },
    },
  },
};
