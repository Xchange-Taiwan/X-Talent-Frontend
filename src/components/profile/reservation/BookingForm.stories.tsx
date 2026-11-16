import type { Meta, StoryObj } from '@storybook/nextjs';
import dayjs from 'dayjs';

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
          '導師個人頁右側預約容器元件，依瀏覽身分切換導師時段管理或學員預約表單，並將 `mentorId` 向下傳遞至 `MenteeBookingForm` 供 GA4 預約漏斗埋點使用。',
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

export const UserDataLoading: Story = {
  args: {
    isOwnMentorProfile: false,
    isUserDataLoading: true,
    isAuthenticated: true,
    slotsSnapshot: { slots: [], monthLoaded: false, reservationsLoaded: false },
    selectedSlot: null,
    setSelectedSlot: () => {},
    isSubmitting: false,
    selectedDate: tomorrowDateStr,
    onReservation: () => {},
    onConfirmReservation: async () => true,
  },
};

export const MentorOwnProfile: Story = {
  args: {
    isOwnMentorProfile: true,
    isUserDataLoading: false,
    isAuthenticated: true,
    slotsSnapshot: {
      slots: mockBookingSlots,
      monthLoaded: true,
      reservationsLoaded: true,
    },
    selectedSlot: null,
    setSelectedSlot: () => {},
    isSubmitting: false,
    selectedDate: tomorrowDateStr,
    onReservation: () => alert('預約設定點擊'),
    onConfirmReservation: async () => true,
  },
};

export const MenteeProfileView: Story = {
  args: {
    isOwnMentorProfile: false,
    isUserDataLoading: false,
    isAuthenticated: true,
    slotsSnapshot: {
      slots: mockBookingSlots,
      monthLoaded: true,
      reservationsLoaded: true,
    },
    selectedSlot: mockBookingSlots[0],
    setSelectedSlot: () => {},
    isSubmitting: false,
    selectedDate: tomorrowDateStr,
    onReservation: () => {},
    onConfirmReservation: async () => true,
  },
};

export const UnauthenticatedVisitorView: Story = {
  args: {
    isOwnMentorProfile: false,
    isUserDataLoading: false,
    isAuthenticated: false,
    slotsSnapshot: {
      slots: mockBookingSlots,
      monthLoaded: true,
      reservationsLoaded: true,
    },
    selectedSlot: mockBookingSlots[0],
    setSelectedSlot: () => {},
    isSubmitting: false,
    selectedDate: tomorrowDateStr,
    onReservation: () => {},
    onConfirmReservation: async () => true,
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
    isSubmitting: false,
    selectedDate: tomorrowDateStr,
    onReservation: () => {},
    onConfirmReservation: async () => true,
  },
};
