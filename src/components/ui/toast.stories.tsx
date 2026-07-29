import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './toast';

const meta: Meta<typeof Toast> = {
  title: 'Components/UI/Toast',
  component: Toast,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Toast>;

// 1. Default Toast Style
export const Default: Story = {
  render: (args) => (
    <ToastProvider>
      <Toast {...args}>
        <div className="grid gap-1">
          <ToastTitle>系統提示</ToastTitle>
          <ToastDescription>您的個人資料已成功同步更新！</ToastDescription>
        </div>
        <ToastClose />
      </Toast>
      <ToastViewport className="relative max-w-sm rounded border p-4" />
    </ToastProvider>
  ),
};

// 2. Destructive Toast Style
export const Destructive: Story = {
  render: (args) => (
    <ToastProvider>
      <Toast {...args} variant="destructive">
        <div className="grid gap-1">
          <ToastTitle>連線錯誤</ToastTitle>
          <ToastDescription>無法連接至伺服器，請稍後再試。</ToastDescription>
        </div>
        <ToastAction
          altText="Try again"
          className="border-status-error-default text-text-white"
        >
          重試
        </ToastAction>
        <ToastClose />
      </Toast>
      <ToastViewport className="relative max-w-sm rounded border p-4" />
    </ToastProvider>
  ),
};
