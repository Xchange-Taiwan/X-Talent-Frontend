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
  title: '基礎/原子元件/Sheet',
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
        <Button variant="outline">開啟導航選單</Button>
      </SheetTrigger>
      <SheetContent side="right" showPrimitiveClose>
        <SheetHeader>
          <SheetTitle>導航選單</SheetTitle>
          <SheetDescription>
            快速瀏覽 X-Talent 的所有主要功能與設定。
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Button variant="ghost" className="justify-start">
              首頁 (Home)
            </Button>
            <Button variant="ghost" className="justify-start">
              找導師 (Find Mentors)
            </Button>
            <Button variant="ghost" className="justify-start">
              我的預約 (My Bookings)
            </Button>
            <Button variant="ghost" className="justify-start">
              個人檔案 (Profile)
            </Button>
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" className="w-full">
            登出 (Logout)
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
        <Button variant="outline">開啟篩選條件</Button>
      </SheetTrigger>
      <SheetContent side="left" showPrimitiveClose>
        <SheetHeader>
          <SheetTitle>篩選條件</SheetTitle>
          <SheetDescription>依據您的需求過濾導師搜尋結果。</SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-text-primary text-sm font-semibold">
                專業領域 (Positions)
              </h4>
              <div className="space-y-2">
                <label className="text-text-secondary flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="bg-background-bottom rounded border"
                  />
                  <span>技術開發 (Tech)</span>
                </label>
                <label className="text-text-secondary flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="bg-background-bottom rounded border"
                  />
                  <span>產品管理 (Product)</span>
                </label>
                <label className="text-text-secondary flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="bg-background-bottom rounded border"
                  />
                  <span>設計行銷 (Design/Marketing)</span>
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-text-primary text-sm font-semibold">
                導師年資 (Seniority)
              </h4>
              <div className="space-y-2">
                <label className="text-text-secondary flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="bg-background-bottom rounded border"
                  />
                  <span>1~3 年</span>
                </label>
                <label className="text-text-secondary flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="bg-background-bottom rounded border"
                  />
                  <span>3~5 年</span>
                </label>
                <label className="text-text-secondary flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="bg-background-bottom rounded border"
                  />
                  <span>5~10 年</span>
                </label>
                <label className="text-text-secondary flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="bg-background-bottom rounded border"
                  />
                  <span>10 年以上</span>
                </label>
              </div>
            </div>
          </div>
        </div>
        <SheetFooter className="absolute inset-x-6 bottom-6">
          <Button className="w-full">套用篩選 (Apply)</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};
