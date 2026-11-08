import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import { mockReservation } from '@/components/reservation/mocks';
import { Button } from '@/components/ui/button';

import { QuickReplyDialog } from './QuickReplyDialog';

const meta: Meta<typeof QuickReplyDialog> = {
  title: '業務模組元件/個人檔案(Profile)/Reservation/QuickReplyDialog',
  component: QuickReplyDialog,
  tags: ['autodocs'],
  args: {
    reservation: mockReservation,
    open: true,
    onOpenChange: () => {},
    myUserId: String(mockReservation.participantUserId),
  },
};

export default meta;
type Story = StoryObj<typeof QuickReplyDialog>;

function DialogDemo(props: React.ComponentProps<typeof QuickReplyDialog>) {
  const [open, setOpen] = useState(props.open);
  return (
    <div className="p-6">
      <Button type="button" onClick={() => setOpen(true)}>
        開啟待回復預約申請
      </Button>
      <QuickReplyDialog {...props} open={open} onOpenChange={setOpen} />
    </div>
  );
}

export const Default: Story = {
  render: (args) => <DialogDemo {...args} />,
};

export const WithoutMenteeMessage: Story = {
  args: {
    reservation: {
      ...mockReservation,
      messages: [],
      menteeMessage: undefined,
    },
  },
  render: (args) => <DialogDemo {...args} />,
};
