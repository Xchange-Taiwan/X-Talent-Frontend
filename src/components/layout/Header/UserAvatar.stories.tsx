import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { UserAvatar } from './UserAvatar';

const meta: Meta<typeof UserAvatar> = {
  title: '佈局元件/Header/UserAvatar',
  component: UserAvatar,
  tags: ['autodocs'],
  args: {
    name: '陳導師 (Mentor)',
    size: 40,
  },
};

export default meta;
type Story = StoryObj<typeof UserAvatar>;

export const DefaultFallback: Story = {
  args: {
    src: null,
    name: '林學員 (Mentee)',
    size: 40,
  },
};

export const CustomAvatarImage: Story = {
  args: {
    src: '/logo.svg',
    name: '陳導師 (Mentor)',
    size: 48,
  },
};

export const SizesShowcase: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <UserAvatar name="Small User" size={28} />
      <UserAvatar name="Medium User" size={40} />
      <UserAvatar name="Large User" size={64} />
    </div>
  ),
};
