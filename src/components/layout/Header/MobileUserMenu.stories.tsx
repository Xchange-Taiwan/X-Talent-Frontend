import type { Meta, StoryObj } from '@storybook/nextjs';
import { SessionProvider } from 'next-auth/react';
import React from 'react';

import { MobileUserMenu } from './MobileUserMenu';

const meta: Meta<typeof MobileUserMenu> = {
  title: 'Layout/Header/MobileUserMenu',
  component: MobileUserMenu,
  tags: ['autodocs'],
  decorators: [
    (Story, context) => {
      const user = context.args.user;
      const mockSession = {
        user,
        accessToken: 'mock-access-token',
        expires: '2099-01-01T00:00:00.000Z',
      };
      return (
        <SessionProvider session={mockSession}>
          <div className="flex min-h-[300px] justify-end bg-background-bottom p-8">
            <Story />
          </div>
        </SessionProvider>
      );
    },
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
    user: mockMentorUser,
  },
};

// 2. Mentee Session
export const MenteeSession: Story = {
  args: {
    user: mockMenteeUser,
  },
};

// 3. User with No Name Fallback
export const AnonymousSession: Story = {
  args: {
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
