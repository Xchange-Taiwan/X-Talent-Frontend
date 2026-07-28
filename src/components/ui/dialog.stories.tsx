import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';

const meta: Meta<typeof Dialog> = {
  title: 'Components/UI/Dialog',
  component: Dialog,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Dialog>;

// 1. Basic Interactive Demo
export const Default: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger asChild>
        <Button variant="outline">開啟對話框</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>編輯個人資料</DialogTitle>
          <DialogDescription>
            在此修改您的帳戶資訊。完成後點擊儲存。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">姓名</label>
            <input
              className="col-span-3 rounded border p-2 text-sm"
              defaultValue="Alex Chen"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">電子信箱</label>
            <input
              className="col-span-3 rounded border p-2 text-sm"
              defaultValue="alex@xchange.tw"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">儲存變更</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

// 2. Alert/Confirm Style Dialog
export const Confirmation: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger asChild>
        <Button variant="destructive">刪除帳號</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>您確定要刪除帳號嗎？</DialogTitle>
          <DialogDescription>
            此動作無法復原。這將永久刪除您的帳號並從我們的伺服器中移除您的所有資料。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline">取消</Button>
          <Button variant="destructive">確定刪除</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
