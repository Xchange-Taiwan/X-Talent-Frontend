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
    allowedDates: [
      formattedTodayStr,
      formattedTomorrowStr,
      formattedNextWeekStr,
    ],
    getDateStatus: (date: Date) => {
      const dateKey = dayjs(date).format('YYYY-MM-DD');
      if (dateKey === formattedTodayStr) return 'PENDING';
      if (dateKey === formattedTomorrowStr) return 'BOOKED';
      return null;
    },
  },
};
