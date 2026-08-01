import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { AvatarSection } from './AvatarSection';
import { ProfileStoryWrapper } from './ProfileStoryWrapper';

const meta: Meta<typeof AvatarSection> = {
  title: '業務模組元件/個人檔案(Profile)/Edit/AvatarSection',
  component: AvatarSection,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof AvatarSection>;

export const Default: Story = {
  parameters: {
    nextAuth: {
      user: {
        avatar: '',
      },
    },
  },
  render: () => (
    <ProfileStoryWrapper defaultValues={{ avatar: null }}>
      {(form) => (
        <AvatarSection control={form.control} name="avatar" isMentor={false} />
      )}
    </ProfileStoryWrapper>
  ),
};

export const WithInitialAvatar: Story = {
  parameters: {
    nextAuth: {
      user: {
        avatar:
          'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80',
      },
    },
  },
  render: () => (
    <ProfileStoryWrapper defaultValues={{ avatar: null }}>
      {(form) => (
        <AvatarSection control={form.control} name="avatar" isMentor={false} />
      )}
    </ProfileStoryWrapper>
  ),
};

export const MentorRequiredState: Story = {
  name: '導師必填狀態 (IsMentor)',
  parameters: {
    nextAuth: {
      user: {
        avatar: '',
      },
    },
  },
  render: () => (
    <ProfileStoryWrapper defaultValues={{ avatar: null }}>
      {(form) => (
        <AvatarSection control={form.control} name="avatar" isMentor={true} />
      )}
    </ProfileStoryWrapper>
  ),
};
