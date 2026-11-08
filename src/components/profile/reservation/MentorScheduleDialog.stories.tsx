import type { Meta, StoryObj } from '@storybook/nextjs';
import dayjs from 'dayjs';
import React, { useState } from 'react';

import type {
  BookingCalendarReader,
  MentorScheduleEditor,
  ParsedMentorTimeslot,
} from '@/lib/profile/bookingAvailability';
import type { Reservation } from '@/types/reservation';

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

const targetDay = dayjs().add(1, 'day').startOf('day');
const pastDay = dayjs().subtract(1, 'day').startOf('day');
const targetDateStr = targetDay.format('YYYY-MM-DD');
const pastDateStr = pastDay.format('YYYY-MM-DD');

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
  const baseDay = isPast ? pastDay : targetDay;
  const start = baseDay
    .hour(hour)
    .minute(minute)
    .second(0)
    .millisecond(0)
    .toDate();
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const occurrenceUnix = Math.floor(start.getTime() / 1000);
  const dateKey = baseDay.format('YYYY-MM-DD');
  return {
    occurrenceId: `${id}_${occurrenceUnix}`,
    id,
    occurrenceUnix,
    type,
    start,
    end,
    durationMinutes: duration,
    formatted: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    dateKey,
    exdate: [],
    slotDurationSeconds: duration * 60,
    isRecurringInstance: false,
  };
};

const allowSlot14 = makeSlot({
  id: 1,
  hour: 14,
  minute: 0,
  duration: 30,
  type: 'ALLOW',
});
const allowSlot15 = makeSlot({
  id: 2,
  hour: 15,
  minute: 0,
  duration: 30,
  type: 'ALLOW',
});
const virtualBookedSlot15 = makeSlot({
  id: -2,
  hour: 15,
  minute: 0,
  duration: 30,
  type: 'BOOKED',
});
const allowSlot16 = makeSlot({
  id: 3,
  hour: 16,
  minute: 0,
  duration: 45,
  type: 'ALLOW',
});
const virtualPendingSlot16 = makeSlot({
  id: -3,
  hour: 16,
  minute: 0,
  duration: 45,
  type: 'PENDING',
});
const pastAllowSlot10 = makeSlot({
  id: 4,
  hour: 10,
  minute: 0,
  duration: 30,
  type: 'ALLOW',
  isPast: true,
});

const mockDraftSlots: ParsedMentorTimeslot[] = [
  allowSlot14,
  allowSlot15,
  virtualBookedSlot15,
  allowSlot16,
  virtualPendingSlot16,
  pastAllowSlot10,
];

const mockReservations: Reservation[] = [
  {
    id: 'res-booked-15',
    name: '王小明',
    roleLine: 'Frontend Engineer @ Startup',
    date: targetDateStr,
    time: '15:00 - 15:30',
    messages: [{ role: 'MENTEE', content: '想請教前端系統設計與職涯規劃' }],
    scheduleId: allowSlot15.id,
    dtstart: allowSlot15.occurrenceUnix,
    dtend: Math.floor(allowSlot15.end.getTime() / 1000),
    version: 1,
    senderUserId: 'mentee-101',
    participantUserId: 'mentor-1',
    viewerRole: 'MENTOR',
  },
  {
    id: 'res-pending-16',
    name: '陳怡君',
    roleLine: 'Product Designer @ Studio',
    date: targetDateStr,
    time: '16:00 - 16:45',
    messages: [{ role: 'MENTEE', content: '想討論作品集與跨國求職準備' }],
    scheduleId: allowSlot16.id,
    dtstart: allowSlot16.occurrenceUnix,
    dtend: Math.floor(allowSlot16.end.getTime() / 1000),
    version: 1,
    senderUserId: 'mentee-102',
    participantUserId: 'mentor-1',
    viewerRole: 'MENTOR',
  },
];

const orphanDraftSlots: ParsedMentorTimeslot[] = [
  allowSlot14,
  // Orphan virtual BOOKED & PENDING slots whose underlying ALLOW schedule rule was deleted
  virtualBookedSlot15,
  virtualPendingSlot16,
];

const defaultReaderMock: BookingCalendarReader = {
  year: targetDay.year(),
  month: targetDay.month() + 1,
  selectedDate: targetDateStr,
  setSelectedDate: () => {},
  allowedDates: [targetDateStr, pastDateStr],
  slotsSnapshot: { slots: [], monthLoaded: true, reservationsLoaded: true },
  getDayBookingStatus: (dateKey: string) =>
    dateKey === targetDateStr ? 'PENDING' : null,
  isFetching: false,
  hasError: false,
  reload: async () => {},
};

const defaultScheduleMock: MentorScheduleEditor = {
  draftForSelectedDate: mockDraftSlots,
  addSlotForSelectedDate: () => ({ added: 1, skipped: 0 }),
  updateDraftSlot: () => ({ success: true }),
  deleteDraftSlot: () => {},
  confirmChanges: async () => ({ ok: true }),
  resetChanges: () => {},
  reservations: mockReservations,
};

interface DialogWrapperProps {
  reader: BookingCalendarReader;
  schedule: MentorScheduleEditor;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onMonthChange?: (date: Date) => void;
}

const DialogWrapper = ({ reader, schedule }: DialogWrapperProps) => {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-brand-500 text-text-white hover:bg-brand-600 rounded px-4 py-2 font-medium transition-colors"
      >
        開啟預約設定 (Open Dialog)
      </button>
      <MentorScheduleDialog
        reader={reader}
        schedule={schedule}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
};

export const Default: Story = {
  render: (args) => (
    <DialogWrapper reader={args.reader} schedule={args.schedule} />
  ),
  args: {
    open: true,
    onOpenChange: () => {},
    reader: defaultReaderMock,
    schedule: defaultScheduleMock,
  },
};

export const WithBookedAndPendingPrompts: Story = {
  render: (args) => (
    <DialogWrapper reader={args.reader} schedule={args.schedule} />
  ),
  args: {
    open: true,
    onOpenChange: () => {},
    reader: defaultReaderMock,
    schedule: {
      ...defaultScheduleMock,
      draftForSelectedDate: [
        allowSlot14,
        allowSlot15,
        virtualBookedSlot15,
        allowSlot16,
        virtualPendingSlot16,
      ],
      reservations: mockReservations,
    },
  },
};

export const OrphanVirtualReservationSlot: Story = {
  render: (args) => (
    <DialogWrapper reader={args.reader} schedule={args.schedule} />
  ),
  args: {
    open: true,
    onOpenChange: () => {},
    reader: defaultReaderMock,
    schedule: {
      ...defaultScheduleMock,
      draftForSelectedDate: orphanDraftSlots,
      reservations: mockReservations,
    },
  },
};

export const Loading: Story = {
  render: (args) => (
    <DialogWrapper reader={args.reader} schedule={args.schedule} />
  ),
  args: {
    open: true,
    onOpenChange: () => {},
    reader: {
      ...defaultReaderMock,
      slotsSnapshot: {
        ...defaultReaderMock.slotsSnapshot,
        monthLoaded: false,
      },
    },
    schedule: {
      ...defaultScheduleMock,
      draftForSelectedDate: [],
    },
  },
};
