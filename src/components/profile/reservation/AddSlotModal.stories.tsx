import type { Meta, StoryObj } from '@storybook/nextjs';
import dayjs from 'dayjs';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { ParsedMentorTimeslot } from '@/lib/profile/bookingAvailability';

import { AddSlotModal } from './AddSlotModal';

const targetDay = dayjs().add(1, 'day').startOf('day');
const targetDateStr = targetDay.format('YYYY-MM-DD');

const existingSlot: ParsedMentorTimeslot = {
  occurrenceId: `1_${targetDay.hour(14).unix()}`,
  id: 1,
  occurrenceUnix: targetDay.hour(14).unix(),
  type: 'ALLOW',
  start: targetDay.hour(14).minute(0).toDate(),
  end: targetDay.hour(14).minute(30).toDate(),
  durationMinutes: 30,
  formatted: '14:00',
  dateKey: targetDateStr,
  exdate: [],
  slotDurationSeconds: 1800,
  isRecurringInstance: false,
};

const meta: Meta<typeof AddSlotModal> = {
  title: '業務模組元件/個人檔案(Profile)/Reservation/AddSlotModal',
  component: AddSlotModal,
  tags: ['autodocs'],
  args: {
    open: true,
    onOpenChange: () => {},
    selectedDate: targetDateStr,
    existingSlots: [],
    onSubmit: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof AddSlotModal>;

function ModalDemo(props: React.ComponentProps<typeof AddSlotModal>) {
  const [open, setOpen] = useState(props.open);
  return (
    <div className="p-6">
      <Button type="button" onClick={() => setOpen(true)}>
        新增可預約時段
      </Button>
      <AddSlotModal {...props} open={open} onOpenChange={setOpen} />
    </div>
  );
}

export const DefaultEmptyDay: Story = {
  render: (args) => <ModalDemo {...args} />,
};

export const AfterExistingSlots: Story = {
  args: {
    existingSlots: [existingSlot],
  },
  render: (args) => <ModalDemo {...args} />,
};
