import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { Reservation } from '@/types/reservation';

import { ReservationBlockPromptDialog } from './ReservationBlockPromptDialog';

const mockMatchedReservation: Reservation = {
  id: 'res-booked-1',
  name: '王小明',
  roleLine: 'Frontend Engineer @ Startup',
  date: '2026-07-26',
  time: '15:00 - 15:30',
  messages: [{ role: 'MENTEE', content: '想請教前端系統設計與職涯規劃' }],
  scheduleId: 2,
  dtstart: 1785078000,
  dtend: 1785079800,
  version: 1,
  senderUserId: 'mentee-101',
  participantUserId: 'mentor-1',
  viewerRole: 'MENTOR',
};

const meta: Meta<typeof ReservationBlockPromptDialog> = {
  title:
    '業務模組元件/個人檔案(Profile)/Reservation/ReservationBlockPromptDialog',
  component: ReservationBlockPromptDialog,
  tags: ['autodocs'],
  args: {
    open: true,
    onOpenChange: () => {},
    promptType: 'BOOKED',
    matchedReservation: mockMatchedReservation,
    onNavigateToReservations: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof ReservationBlockPromptDialog>;

function PromptDemo(
  props: React.ComponentProps<typeof ReservationBlockPromptDialog>
) {
  const [open, setOpen] = useState(props.open);
  return (
    <div className="p-6">
      <Button type="button" onClick={() => setOpen(true)}>
        檢視預約鎖定提示
      </Button>
      <ReservationBlockPromptDialog
        {...props}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}

export const BookedWithMenteeName: Story = {
  render: (args) => <PromptDemo {...args} />,
};

export const BookedGenericFallback: Story = {
  args: {
    matchedReservation: undefined,
  },
  render: (args) => <PromptDemo {...args} />,
};

export const PendingWithMenteeName: Story = {
  args: {
    promptType: 'PENDING',
    matchedReservation: {
      ...mockMatchedReservation,
      name: '陳怡君',
    },
  },
  render: (args) => <PromptDemo {...args} />,
};

export const PendingGenericFallback: Story = {
  args: {
    promptType: 'PENDING',
    matchedReservation: undefined,
  },
  render: (args) => <PromptDemo {...args} />,
};
