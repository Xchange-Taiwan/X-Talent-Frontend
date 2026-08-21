import type { Meta, StoryObj } from '@storybook/nextjs';
import React, { useState } from 'react';

import type {
  ParsedMentorTimeslot,
  UseMentorScheduleReturn,
} from '@/hooks/useMentorSchedule';

import MentorScheduleDialog from './MentorScheduleDialog';

const meta: Meta<typeof MentorScheduleDialog> = {
  title: '業務模組元件/個人檔案(Profile)/Reservation/MentorScheduleDialog',
  component: MentorScheduleDialog,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="min-h-[600px] p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MentorScheduleDialog>;

const todayStr = '2026-08-05';

// Helpers to construct ParsedMentorTimeslot
const makeSlot = ({
  id,
  hour,
  minute,
  duration,
  type,
  isPast = false,
}: {
  id: number;
  hour: number;
  minute: number;
  duration: number;
  type: 'ALLOW' | 'BOOKED' | 'PENDING';
  isPast?: boolean;
}): ParsedMentorTimeslot => {
  const year = 2026;
  const month = 8;
  const day = isPast ? 4 : 5;
  const start = new Date(year, month - 1, day, hour, minute);
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const occurrenceUnix = Math.floor(start.getTime() / 1000);
  return {
    occurrenceId: `${id}_${occurrenceUnix}`,
    id,
    occurrenceUnix,
    type,
    start,
    end,
    durationMinutes: duration,
    formatted: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    dateKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    exdate: [],
    slotDurationSeconds: duration * 60,
    isRecurringInstance: false,
  };
};

const mockDraftSlots: ParsedMentorTimeslot[] = [
  // 1. Available future slot
  makeSlot({ id: 1, hour: 14, minute: 0, duration: 30, type: 'ALLOW' }),

  // 2. Booked future slot (ALLOW slot matched by a BOOKED status start)
  makeSlot({ id: 2, hour: 15, minute: 0, duration: 30, type: 'ALLOW' }),
  makeSlot({ id: 2, hour: 15, minute: 0, duration: 30, type: 'BOOKED' }),

  // 3. Pending future slot (ALLOW slot matched by a PENDING status start)
  makeSlot({ id: 3, hour: 16, minute: 0, duration: 45, type: 'ALLOW' }),
  makeSlot({ id: 3, hour: 16, minute: 0, duration: 45, type: 'PENDING' }),

  // 4. Past slot (ALLOW slot starting in the past relative to 2026-08-05)
  makeSlot({
    id: 4,
    hour: 10,
    minute: 0,
    duration: 30,
    type: 'ALLOW',
    isPast: true,
  }),
];

const defaultScheduleMock: UseMentorScheduleReturn = {
  loaded: true,
  monthLoaded: true,
  isFetching: false,
  selectedDate: todayStr,
  setSelectedDate: () => {},
  parsedDraft: mockDraftSlots,
  draftForSelectedDate: mockDraftSlots,
  allowedDates: [todayStr, '2026-08-04'],
  generateBookingSlots: () => [],
  getDayBookingStatus: () => null,
  addSlotForSelectedDate: () => ({ added: 1, skipped: 0 }),
  updateDraftSlot: () => ({ success: true }),
  deleteDraftSlot: () => {},
  confirmChanges: async () => ({ ok: true }),
  resetChanges: () => {},
  reservations: [],
};

interface DialogWrapperProps {
  schedule: UseMentorScheduleReturn;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onMonthChange?: (date: Date) => void;
}

const DialogWrapper = ({ schedule }: DialogWrapperProps) => {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-brand-500 px-4 py-2 font-medium text-text-white transition-colors hover:bg-brand-600"
      >
        開啟預約設定 (Open Dialog)
      </button>
      <MentorScheduleDialog
        schedule={schedule}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
};

export const Default: Story = {
  render: (args) => <DialogWrapper schedule={args.schedule} />,
  args: {
    open: true,
    onOpenChange: () => {},
    schedule: defaultScheduleMock,
  },
};

export const Loading: Story = {
  render: (args) => <DialogWrapper schedule={args.schedule} />,
  args: {
    open: true,
    onOpenChange: () => {},
    schedule: {
      ...defaultScheduleMock,
      monthLoaded: false,
      draftForSelectedDate: [],
    },
  },
};
