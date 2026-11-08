import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Button } from '@/components/ui/button';

import { ConfirmDialog } from './ConfirmDialog';

const meta: Meta<typeof ConfirmDialog> = {
  title: '業務模組元件/個人檔案(Profile)/Edit/ConfirmDialog',
  component: ConfirmDialog,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ConfirmDialog>;

export const DeleteEducation: Story = {
  args: {
    title: '確認刪除學歷資訊？',
    description: '刪除後將無法復原，您確定要刪除這筆學歷記錄嗎？',
    onConfirm: () => alert('學歷已刪除！'),
    trigger: <Button variant="destructive">刪除學歷</Button>,
  },
};

export const Logout: Story = {
  args: {
    title: '確認要登出嗎？',
    description: '登出後需要重新登入才能使用平台完整功能。',
    onConfirm: () => alert('帳號已登出！'),
    trigger: <Button variant="outline">帳號登出</Button>,
  },
};
