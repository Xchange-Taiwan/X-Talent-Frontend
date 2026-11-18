import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import { mockReservation } from '@/components/reservation/mocks';
import { Button } from '@/components/ui/button';

import { QuickReplyDialog } from './QuickReplyDialog';

const meta: Meta<typeof QuickReplyDialog> = {
  title: '業務模組元件/個人檔案(Profile)/Reservation/QuickReplyDialog',
  component: QuickReplyDialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          '導師於個人檔案日曆點擊「待回覆」時段時彈出的快速審核對話框，支援透過統一的 `quickReplyFormSchema`（500 字上限）附上選填回覆接受預約或拒絕預約，並由 mutation 層單次同步更新預約與行事曆快取。',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof QuickReplyDialog>;

const DialogDemo = (args: React.ComponentProps<typeof QuickReplyDialog>) => {
  const [open, setOpen] = useState(args.open ?? false);

  return (
    <div>
      <Button onClick={() => setOpen(true)}>開啟快速回覆對話框</Button>
      <QuickReplyDialog
        {...args}
        open={open}
        onOpenChange={(val) => {
          setOpen(val);
          args.onOpenChange?.(val);
        }}
      />
    </div>
  );
};

export const Default: Story = {
  args: {
    reservation: mockReservation,
    open: false,
    myUserId: 'mentor-1',
  },
  render: (args) => <DialogDemo {...args} />,
};

export const OpenByDefault: Story = {
  args: {
    reservation: mockReservation,
    open: true,
    myUserId: 'mentor-1',
  },
  render: (args) => <DialogDemo {...args} />,
};

export const WithoutMenteeMessage: Story = {
  args: {
    reservation: {
      ...mockReservation,
      messages: [],
      menteeMessage: undefined,
    },
    myUserId: 'mentor-1',
  },
  render: (args) => <DialogDemo {...args} />,
};

/**
 * 接受預約結果統一由後端資料庫統計（#923），前端僅保留對話框開啟與個資遮罩，不重複發送 `reservation_accepted` (#950)。
 */
export const OpenWithoutMenteeMessage: Story = {
  args: {
    reservation: {
      ...mockReservation,
      messages: [],
      menteeMessage: undefined,
    },
    open: true,
    myUserId: 'mentor-1',
  },
  render: (args) => <DialogDemo {...args} />,
};
