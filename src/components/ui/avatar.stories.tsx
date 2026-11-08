import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from './avatar';

const meta: Meta<typeof Avatar> = {
  title: '基礎/原子元件/Avatar',
  component: Avatar,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Avatar>;

// 1. With Image
export const WithImage: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage
        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80"
        alt="林小明"
      />
      <AvatarFallback>LM</AvatarFallback>
    </Avatar>
  ),
};

// 2. Fallback Only
export const FallbackOnly: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src="" alt="Nonexistent User" />
      <AvatarFallback>LM</AvatarFallback>
    </Avatar>
  ),
};
