import type { Meta, StoryObj } from '@storybook/nextjs';
import dayjs from 'dayjs';

import { ScheduleCalendar } from './ScheduleCalendar';

const meta: Meta<typeof ScheduleCalendar> = {
  title: '業務模組元件/個人檔案(Profile)/Reservation/ScheduleCalendar',
  component: ScheduleCalendar,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ScheduleCalendar>;

const today = dayjs();
const formattedTodayStr = today.format('YYYY-MM-DD');
const formattedTomorrowStr = today.add(1, 'day').format('YYYY-MM-DD');
const formattedNextWeekStr = today.add(7, 'day').format('YYYY-MM-DD');

export const Default: Story = {
  args: {
    selected: today.toDate(),
    showTodayStyle: true,
  },
};

export const WithAvailableDates: Story = {
  args: {
    selected: today.toDate(),
    showTodayStyle: true,
    highlightAvailableDates: true,
    disableEmptyDates: true,
    allowedDates: [
      formattedTodayStr,
      formattedTomorrowStr,
      formattedNextWeekStr,
    ],
  },
};

export const ProfileSize: Story = {
  args: {
    selected: today.toDate(),
    showTodayStyle: true,
    size: 'profile',
    highlightAvailableDates: true,
    allowedDates: [
      formattedTodayStr,
      formattedTomorrowStr,
      formattedNextWeekStr,
    ],
  },
};

export const Loading: Story = {
  args: {
    selected: today.toDate(),
    isMonthLoading: true,
  },
};

export const PastDisabled: Story = {
  args: {
    selected: today.toDate(),
    disablePastDates: true,
  },
};

export const WithStatusDots: Story = {
  args: {
    selected: today.toDate(),
    showTodayStyle: true,
    size: 'profile',
    isOwnMentorProfile: true,
    allowedDates: [
      formattedTodayStr,
      formattedTomorrowStr,
      formattedNextWeekStr,
    ],
    generateBookingSlots: (dateKey: string) => {
      if (dateKey === formattedTodayStr) {
        return [
          {
            start: new Date(),
            end: new Date(),
            scheduleId: 1,
            isBooked: false,
            status: 'PENDING',
          },
        ];
      }
      if (dateKey === formattedTomorrowStr) {
        return [
          {
            start: new Date(),
            end: new Date(),
            scheduleId: 2,
            isBooked: true,
            status: 'BOOKED',
          },
        ];
      }
      return [
        {
          start: new Date(),
          end: new Date(),
          scheduleId: 3,
          isBooked: false,
          status: null,
        },
      ];
    },
  },
};
