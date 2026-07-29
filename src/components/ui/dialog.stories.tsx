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
        <Button variant="outline">編輯檔案</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>編輯導師專業檔案</DialogTitle>
          <DialogDescription>
            在此修改您的導師專業檔案資訊。完成後點擊儲存。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">導師姓名</label>
            <input
              className="col-span-3 rounded border p-2 text-sm"
              defaultValue="林小明"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label className="text-right text-sm font-medium">聯絡信箱</label>
            <input
              className="col-span-3 rounded border p-2 text-sm"
              defaultValue="xiaoming.lin@xchange.tw"
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
        <Button variant="destructive">取消預約</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>確定要取消本次諮詢預約嗎？</DialogTitle>
          <DialogDescription>
            取消預約將會發送通知給對方。若在諮詢前 24
            小時內取消，可能會影響您的信用評分。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline">保留預約</Button>
          <Button variant="destructive">確定取消</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
