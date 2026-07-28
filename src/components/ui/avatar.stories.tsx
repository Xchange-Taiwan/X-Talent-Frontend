import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from './avatar';

const meta: Meta<typeof Avatar> = {
  title: 'Components/UI/Avatar',
  component: Avatar,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Avatar>;

// 1. With Image
export const WithImage: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
      <AvatarFallback>CN</AvatarFallback>
    </Avatar>
  ),
};

// 2. Fallback Only
export const FallbackOnly: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src="" alt="Nonexistent User" />
      <AvatarFallback>XT</AvatarFallback>
    </Avatar>
  ),
};
