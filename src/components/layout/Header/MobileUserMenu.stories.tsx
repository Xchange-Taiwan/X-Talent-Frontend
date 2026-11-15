import type { Meta, StoryObj } from '@storybook/nextjs';
import type { Session } from 'next-auth';
import React from 'react';

import { useHeaderNavigation } from '@/hooks/layout/useHeaderNavigation';
import type { ResolvedIdentity } from '@/lib/auth/sessionHint';
import {
  authenticatedIdentity,
  buildResolvedIdentity,
} from '@/test/mocks/identity';

import { MobileUserMenu } from './MobileUserMenu';
import { ShareProfileDialog } from './ShareProfileDialog';

type MobileUserMenuStoryArgs = {
  identity: ResolvedIdentity;
  user?: Session['user'];
};

function MobileUserMenuStoryHarness({
  identity,
  user,
}: MobileUserMenuStoryArgs): JSX.Element {
  const navigation = useHeaderNavigation({ identity, user });
  return (
    <>
      <MobileUserMenu
        profileHeader={navigation.profileHeader}
        menu={navigation.mobileAccountMenu}
      />
      <ShareProfileDialog
        open={navigation.activeDialog === 'share-profile'}
        onOpenChange={(open) =>
          navigation.setActiveDialog(open ? 'share-profile' : null)
        }
        name={navigation.profileHeader.displayName}
        avatarSrc={navigation.profileHeader.avatarSrc}
        subtitle={navigation.profileHeader.subtitle}
        profilePath={navigation.profileHeader.href}
        personalLinks={navigation.profileHeader.personalLinks}
      />
    </>
  );
}

const meta: Meta<typeof MobileUserMenuStoryHarness> = {
  title: '佈局元件/Header/MobileUserMenu',
  component: MobileUserMenuStoryHarness,
  tags: ['autodocs'],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
    docs: {
      description: {
        component:
          '行動版已登入會員側欄選單，由 `useHeaderNavigation` 驅動語意化 `<Link href>` / `<a href>` 導覽項目、`aria-current="page"`、外部連結 `aria-label` 與 `hint-only` 禁用防護。',
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
type Story = StoryObj<typeof MobileUserMenuStoryHarness>;

const mockMentorUser: Session['user'] = {
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

const mockMenteeUser: Session['user'] = {
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
    identity: authenticatedIdentity('mentor-123', {
      isMentor: true,
      name: mockMentorUser.name,
      avatar: mockMentorUser.avatar,
      jobTitle: mockMentorUser.jobTitle,
      company: mockMentorUser.company,
      personalLinks: mockMentorUser.personalLinks,
    }),
    user: mockMentorUser,
  },
};

// 2. Mentee Session
export const MenteeSession: Story = {
  args: {
    identity: authenticatedIdentity('mentee-456', {
      isMentor: false,
      name: mockMenteeUser.name,
      avatar: mockMenteeUser.avatar,
      jobTitle: mockMenteeUser.jobTitle,
      company: mockMenteeUser.company,
    }),
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

// 4. Hint-Only Pre-Resolution Disabled Guard
export const HintOnlyDisabledState: Story = {
  args: {
    identity: buildResolvedIdentity({
      state: 'hint-only',
      isMentor: false,
      avatar: mockMenteeUser.avatar,
    }),
  },
};
