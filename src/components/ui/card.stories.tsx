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
  title: '基礎/原子元件/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: '自定義的 CSS class 名稱以設定卡片樣式',
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
        <CardTitle>預約導師諮詢</CardTitle>
        <CardDescription>
          與資深工程師林小明預約一對一職涯諮詢。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid w-full items-center gap-4">
          <div className="flex flex-col space-y-1.5">
            <span className="text-text-secondary text-sm font-medium">
              諮詢項目
            </span>
            <div className="bg-background-bottom text-text-tertiary rounded border p-2 text-sm">
              前端架構與 React 效能優化
            </div>
          </div>
          <div className="flex flex-col space-y-1.5">
            <span className="text-text-secondary text-sm font-medium">
              諮詢時間
            </span>
            <div className="bg-background-bottom text-text-tertiary rounded border p-2 text-sm">
              2026-08-15 14:00 - 15:00 (GMT+8)
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline">拒絕</Button>
        <Button>接受預約</Button>
      </CardFooter>
    </Card>
  ),
};

// 2. Simple Card (No Header/Footer)
export const ContentOnly: Story = {
  render: (args) => (
    <Card {...args} className="w-[350px]">
      <CardContent className="pt-6">
        <p className="text-text-tertiary text-sm">
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
      <Card
        {...args}
        className="border-l-status-success-default w-[250px] border-l-4"
      >
        <CardHeader className="pb-2">
          <CardDescription>已同步導師</CardDescription>
          <CardTitle className="text-status-success-default text-3xl font-bold">
            128 位
          </CardTitle>
        </CardHeader>
      </Card>
      <Card
        {...args}
        className="border-l-status-warning-default w-[250px] border-l-4"
      >
        <CardHeader className="pb-2">
          <CardDescription>待審核預約</CardDescription>
          <CardTitle className="text-status-warning-default text-3xl font-bold">
            12 筆
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  ),
};
