import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Button } from './button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './sheet';

const meta: Meta<typeof Sheet> = {
  title: 'Components/UI/Sheet',
  component: Sheet,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Sheet>;

// 1. Basic Interactive Demo (Right Side)
export const Default: Story = {
  render: (args) => (
    <Sheet {...args}>
      <SheetTrigger asChild>
        <Button variant="outline">開啟側邊欄 (右側)</Button>
      </SheetTrigger>
      <SheetContent side="right" showPrimitiveClose>
        <SheetHeader>
          <SheetTitle>導航選單</SheetTitle>
          <SheetDescription>
            快速瀏覽本站的所有主要功能與設定。
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Button variant="ghost" className="justify-start">
              首頁
            </Button>
            <Button variant="ghost" className="justify-start">
              找導師
            </Button>
            <Button variant="ghost" className="justify-start">
              個人檔案
            </Button>
            <Button variant="ghost" className="justify-start">
              預約紀錄
            </Button>
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" className="w-full">
            登出
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

// 2. Left Side Sheet
export const LeftSide: Story = {
  render: (args) => (
    <Sheet {...args}>
      <SheetTrigger asChild>
        <Button variant="outline">開啟側邊欄 (左側)</Button>
      </SheetTrigger>
      <SheetContent side="left" showPrimitiveClose>
        <SheetHeader>
          <SheetTitle>篩選條件</SheetTitle>
          <SheetDescription>依據您的需求過濾搜尋結果。</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <p className="text-sm text-text-tertiary">在此放置篩選器元件...</p>
        </div>
      </SheetContent>
    </Sheet>
  ),
};
