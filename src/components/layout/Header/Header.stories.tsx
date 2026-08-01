import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Header } from './Header';

const meta: Meta<typeof Header> = {
  title: '佈局元件/Header/Header',
  component: Header,
  tags: ['autodocs'],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
  decorators: [
    (Story) => (
      <div className="min-h-[120px] bg-background-bottom">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Header>;

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

// 1. Unresolved / Loading State
export const UnresolvedState: Story = {
  parameters: {
    auth: {
      status: 'loading',
      session: null,
      sessionHint: undefined,
    },
  },
};

// 2. Guest State (Not Logged In)
export const GuestState: Story = {
  parameters: {
    auth: {
      status: 'unauthenticated',
      session: null,
      sessionHint: undefined,
    },
  },
};

// 3. Mentor Session
export const MentorSession: Story = {
  parameters: {
    auth: {
      status: 'authenticated',
      session: {
        user: mockMentorUser,
        expires: '2099-01-01T00:00:00.000Z',
      },
      sessionHint: '1',
    },
  },
};

// 4. Mentee Session
export const MenteeSession: Story = {
  parameters: {
    auth: {
      status: 'authenticated',
      session: {
        user: mockMenteeUser,
        expires: '2099-01-01T00:00:00.000Z',
      },
      sessionHint: '0',
    },
  },
};

// 5. Resolving User State (Logged in per hint cookie, but full session is loading)
export const ResolvingUserState: Story = {
  parameters: {
    auth: {
      status: 'loading',
      session: null,
      sessionHint: '0', // logged in as mentee but session details are loading
    },
  },
};
