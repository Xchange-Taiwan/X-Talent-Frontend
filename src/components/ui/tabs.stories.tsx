import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

const meta: Meta<typeof Tabs> = {
  title: 'Components/UI/Tabs',
  component: Tabs,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Tabs>;

// 1. Basic Interactive Demo
export const Default: Story = {
  render: (args) => (
    <Tabs {...args} defaultValue="account" className="w-[400px]">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="account">帳戶設定</TabsTrigger>
        <TabsTrigger value="password">密碼安全</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <div className="rounded-lg border p-4">
          <h3 className="text-lg font-medium">帳戶資訊</h3>
          <p className="mb-4 text-sm text-text-tertiary">
            在此管理您的帳戶基本設定與偏好。
          </p>
          <div className="space-y-2">
            <span className="text-sm font-medium">使用者名稱</span>
            <div className="rounded border bg-background-bottom p-2 text-sm text-text-tertiary">
              alex_chen
            </div>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="password">
        <div className="rounded-lg border p-4">
          <h3 className="text-lg font-medium">重設密碼</h3>
          <p className="mb-4 text-sm text-text-tertiary">
            為了帳戶安全，請定期更新您的密碼。
          </p>
          <div className="space-y-2">
            <span className="text-sm font-medium">新密碼</span>
            <div className="rounded border bg-background-bottom p-2 text-sm text-text-tertiary">
              ********
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  ),
};
