import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import { mockReservation } from '@/components/reservation/mocks';
import { Button } from '@/components/ui/button';
import type { Reservation } from '@/types/reservation';

import { ConfirmedReservationDialog } from './ConfirmedReservationDialog';

const confirmedReservation: Reservation = {
  ...mockReservation,
  dtstart: Math.floor(Date.now() / 1000) + 45 * 60,
  dtend: Math.floor(Date.now() / 1000) + 105 * 60,
  messages: [
    ...mockReservation.messages,
    {
      content: '期待週三晚上線上見！屆時請先準備好想討論的架構圖或程式碼片段。',
      role: 'MENTOR',
    },
  ],
  mentorMessage: {
    content: '期待週三晚上線上見！屆時請先準備好想討論的架構圖或程式碼片段。',
    role: 'MENTOR',
  },
};

const meta: Meta<typeof ConfirmedReservationDialog> = {
  title:
    '業務模組元件/個人檔案(Profile)/Reservation/ConfirmedReservationDialog',
  component: ConfirmedReservationDialog,
  tags: ['autodocs'],
  args: {
    reservation: confirmedReservation,
    open: true,
    onOpenChange: () => {},
    myUserId: String(confirmedReservation.participantUserId),
  },
};

export default meta;
type Story = StoryObj<typeof ConfirmedReservationDialog>;

function DialogDemo(
  props: React.ComponentProps<typeof ConfirmedReservationDialog>
) {
  const [open, setOpen] = useState(props.open);
  return (
    <div className="p-6">
      <Button type="button" onClick={() => setOpen(true)}>
        檢視已確認預約詳情
      </Button>
      <ConfirmedReservationDialog
        {...props}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}

export const Default: Story = {
  render: (args) => <DialogDemo {...args} />,
};

export const ImminentSession: Story = {
  args: {
    reservation: {
      ...confirmedReservation,
      dtstart: Math.floor(Date.now() / 1000) + 10 * 60,
      dtend: Math.floor(Date.now() / 1000) + 70 * 60,
    },
  },
  render: (args) => <DialogDemo {...args} />,
};
