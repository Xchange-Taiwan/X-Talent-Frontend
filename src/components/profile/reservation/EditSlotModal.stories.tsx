import type { Meta, StoryObj } from '@storybook/nextjs';
import dayjs from 'dayjs';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { ParsedMentorTimeslot } from '@/lib/profile/bookingAvailability';

import { EditSlotModal } from './EditSlotModal';

const targetDay = dayjs().add(1, 'day').startOf('day');
const sampleSlot: ParsedMentorTimeslot = {
  occurrenceId: `1_${targetDay.hour(14).unix()}`,
  id: 1,
  occurrenceUnix: targetDay.hour(14).unix(),
  type: 'ALLOW',
  start: targetDay.hour(14).minute(0).toDate(),
  end: targetDay.hour(14).minute(45).toDate(),
  durationMinutes: 45,
  formatted: '14:00',
  dateKey: targetDay.format('YYYY-MM-DD'),
  exdate: [],
  slotDurationSeconds: 2700,
  isRecurringInstance: false,
};

const meta: Meta<typeof EditSlotModal> = {
  title: '業務模組元件/個人檔案(Profile)/Reservation/EditSlotModal',
  component: EditSlotModal,
  tags: ['autodocs'],
  args: {
    open: true,
    slot: sampleSlot,
    onClose: () => {},
    onSubmit: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof EditSlotModal>;

function ModalDemo(props: React.ComponentProps<typeof EditSlotModal>) {
  const [open, setOpen] = useState(props.open);
  return (
    <div className="p-6">
      <Button type="button" onClick={() => setOpen(true)}>
        編輯時段
      </Button>
      <EditSlotModal {...props} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

export const Default: Story = {
  render: (args) => <ModalDemo {...args} />,
};
