import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Button } from './button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card';

const meta: Meta<typeof Card> = {
  title: 'Components/UI/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Custom CSS classes for styling the card',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

// 1. Basic Interactive Demo
export const Default: Story = {
  render: (args) => (
    <Card {...args} className="w-[350px]">
      <CardHeader>
        <CardTitle>建立專案</CardTitle>
        <CardDescription>一鍵部署您的新專案與相關設定。</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid w-full items-center gap-4">
          <div className="flex flex-col space-y-1.5">
            <span className="text-sm font-medium">專案名稱</span>
            <div className="bg-slate-50 rounded border p-2 text-sm text-muted-foreground">
              My New Awesome Project
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline">取消</Button>
        <Button>部署</Button>
      </CardFooter>
    </Card>
  ),
};

// 2. Simple Card (No Header/Footer)
export const ContentOnly: Story = {
  render: (args) => (
    <Card {...args} className="w-[350px]">
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">
          這是一個極簡卡片，只包含內容區塊，適合用在格狀版面 (Grid)
          中展示簡單的統計數據或資訊卡片。
        </p>
      </CardContent>
    </Card>
  ),
};

// 3. Status Card Demo
export const StatusCard: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-4">
      <Card {...args} className="border-l-emerald-500 w-[250px] border-l-4">
        <CardHeader className="pb-2">
          <CardDescription>已同步導師</CardDescription>
          <CardTitle className="text-emerald-600 text-3xl font-bold">
            128 位
          </CardTitle>
        </CardHeader>
      </Card>
      <Card {...args} className="border-l-amber-500 w-[250px] border-l-4">
        <CardHeader className="pb-2">
          <CardDescription>待審核清單</CardDescription>
          <CardTitle className="text-amber-600 text-3xl font-bold">
            12 筆
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  ),
};
