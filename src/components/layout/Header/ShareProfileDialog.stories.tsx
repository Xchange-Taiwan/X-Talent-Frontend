import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';

import { ShareProfileDialog } from './ShareProfileDialog';

const meta: Meta<typeof ShareProfileDialog> = {
  title: 'Layout/Header/ShareProfileDialog',
  component: ShareProfileDialog,
  tags: ['autodocs'],
  args: {
    open: true,
    name: '王小明',
    avatarSrc:
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
    subtitle: 'Senior Software Engineer at Google',
    profilePath: '/profile/user-123',
    personalLinks: [
      { platform: 'linkedin', url: 'https://linkedin.com/in/username' },
      { platform: 'github', url: 'https://github.com/username' },
    ],
  },
};

export default meta;
type Story = StoryObj<typeof ShareProfileDialog>;

export const DefaultOpen: Story = {
  args: {
    open: true,
  },
};

export const WithoutAvatar: Story = {
  args: {
    open: true,
    avatarSrc: undefined,
  },
};

export const WithoutSubtitleOrLinks: Story = {
  args: {
    open: true,
    subtitle: undefined,
    personalLinks: [],
  },
};

export const Interactive: Story = {
  render: (args) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [open, setOpen] = useState(false);
    return (
      <div className="p-8">
        <Button onClick={() => setOpen(true)}>點擊開啟分享彈窗</Button>
        <ShareProfileDialog {...args} open={open} onOpenChange={setOpen} />
      </div>
    );
  },
};
