import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';
import { useForm } from 'react-hook-form';

import AvatarUpload from './avatar-upload';

const meta: Meta<typeof AvatarUpload> = {
  title: '基礎/原子元件/AvatarUpload',
  component: AvatarUpload,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AvatarUpload>;

const AvatarUploadWrapper = (args: { avatarUrl?: string }) => {
  const { control } = useForm({
    defaultValues: {
      avatar: null,
    },
  });
  return (
    <AvatarUpload control={control} name="avatar" avatarUrl={args.avatarUrl} />
  );
};

export const Default: Story = {
  render: (args) => <AvatarUploadWrapper {...args} />,
  args: {
    avatarUrl: '',
  },
};

export const WithInitialAvatar: Story = {
  render: (args) => <AvatarUploadWrapper {...args} />,
  args: {
    avatarUrl:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80',
  },
};
