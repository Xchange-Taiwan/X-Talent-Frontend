import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { step1Schema } from './index';
import { OnboardingStoryWrapper } from './OnboardingStoryWrapper';
import { WhoAreYou } from './WhoAreYou';

const meta: Meta<typeof WhoAreYou> = {
  title: 'Onboarding/Steps/WhoAreYou',
  component: WhoAreYou,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof WhoAreYou>;

export const LoadingOrUnresolved: Story = {
  render: () => (
    <OnboardingStoryWrapper
      schema={step1Schema}
      defaultValues={{
        name: '',
        avatar: '',
        avatarFile: undefined,
        language: 'zh_TW',
      }}
      session={null}
    >
      {(form) => <WhoAreYou form={form} />}
    </OnboardingStoryWrapper>
  ),
};

export const MentorSelected: Story = {
  render: () => (
    <OnboardingStoryWrapper
      schema={step1Schema}
      defaultValues={{
        name: '王小明 (Mentor)',
        avatar:
          'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
        avatarFile: undefined,
        language: 'zh_TW',
      }}
      session={{
        user: {
          id: 'user-mentor-123',
          name: '王小明 (Mentor)',
          avatar:
            'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
          avatarUpdatedAt: 123456789,
          isMentor: true,
        },
        expires: '2027-01-01T00:00:00.000Z',
      }}
    >
      {(form) => <WhoAreYou form={form} />}
    </OnboardingStoryWrapper>
  ),
};

export const MenteeSelected: Story = {
  render: () => (
    <OnboardingStoryWrapper
      schema={step1Schema}
      defaultValues={{
        name: '陳小美 (Mentee)',
        avatar:
          'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
        avatarFile: undefined,
        language: 'zh_TW',
      }}
      session={{
        user: {
          id: 'user-mentee-123',
          name: '陳小美 (Mentee)',
          avatar:
            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
          avatarUpdatedAt: 123456789,
          isMentor: false,
        },
        expires: '2027-01-01T00:00:00.000Z',
      }}
    >
      {(form) => <WhoAreYou form={form} />}
    </OnboardingStoryWrapper>
  ),
};
