import type { Meta, StoryObj } from '@storybook/nextjs';
import dayjs from 'dayjs';

import type { BookingCalendarReader } from '@/lib/profile/bookingAvailability';

import { mockBookingSlots } from './__mocks__/reservationStories.mock';
import { BookingForm } from './BookingForm';

const meta: Meta<typeof BookingForm> = {
  title: '業務模組元件/個人檔案(Profile)/Reservation/BookingForm',
  component: BookingForm,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '導師個人頁右側預約容器元件，直接接收 `BookingCalendarReader` 並自動綁定 `onMutationSuccess={reader?.reload}`，依瀏覽身分切換導師時段管理或學員預約表單，並將 `mentorId` 向下傳遞至 `MenteeBookingForm` 供 GA4 預約漏斗埋點使用。',
      },
    },
  },
  args: {
    mentorId: 7482008160728084,
  },
};

export default meta;
type Story = StoryObj<typeof BookingForm>;

const tomorrowDateStr = dayjs().add(1, 'day').format('YYYY-MM-DD');

const mockCalendarReader: BookingCalendarReader = {
  selectedDate: tomorrowDateStr,
  setSelectedDate: () => {},
  selectedSlot: mockBookingSlots[0],
  setSelectedSlot: () => {},
  allowedDates: [tomorrowDateStr],
  slotsSnapshot: {
    slots: mockBookingSlots,
    monthLoaded: true,
    reservationsLoaded: true,
  },
  getDayBookingStatus: () => 'PENDING',
  isFetching: false,
  reload: async () => {},
};

export const UserDataLoading: Story = {
  args: {
    isOwnMentorProfile: false,
    isUserDataLoading: true,
    isAuthenticated: true,
    reader: {
      ...mockCalendarReader,
      selectedSlot: null,
      slotsSnapshot: {
        slots: [],
        monthLoaded: false,
        reservationsLoaded: false,
      },
    },
    onReservation: () => {},
  },
};

export const MentorOwnProfile: Story = {
  args: {
    isOwnMentorProfile: true,
    isUserDataLoading: false,
    isAuthenticated: true,
    myUserId: '7482008160728084',
    reader: {
      ...mockCalendarReader,
      selectedSlot: null,
    },
    onReservation: () => alert('預約設定點擊'),
  },
};

export const MenteeProfileView: Story = {
  args: {
    isOwnMentorProfile: false,
    isUserDataLoading: false,
    isAuthenticated: true,
    myUserId: '7482008160728087',
    reader: mockCalendarReader,
    onReservation: () => {},
  },
};

export const UnauthenticatedVisitorView: Story = {
  args: {
    isOwnMentorProfile: false,
    isUserDataLoading: false,
    isAuthenticated: false,
    reader: mockCalendarReader,
    onReservation: () => {},
  },
};

export const NoAvailableSlotsView: Story = {
  args: {
    isOwnMentorProfile: false,
    isUserDataLoading: false,
    isAuthenticated: true,
    slotsSnapshot: {
      slots: [],
      monthLoaded: true,
      reservationsLoaded: true,
    },
    selectedSlot: null,
    setSelectedSlot: () => {},
    selectedDate: tomorrowDateStr,
    onReservation: () => {},
  },
};
