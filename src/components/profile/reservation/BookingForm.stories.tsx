import type { Meta, StoryObj } from '@storybook/nextjs';

import { mockBookingSlots } from './__mocks__/reservationStories.mock';
import { BookingForm } from './BookingForm';

const meta: Meta<typeof BookingForm> = {
  title: '業務模組元件/個人檔案(Profile)/Reservation/BookingForm',
  component: BookingForm,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof BookingForm>;

export const UserDataLoading: Story = {
  args: {
    isOwnMentorProfile: false,
    isUserDataLoading: true,
    isAuthenticated: true,
    slots: [],
    monthLoaded: false,
    selectedSlot: null,
    setSelectedSlot: () => {},
    isSubmitting: false,
    selectedDate: '2026-08-05',
    onReservation: () => {},
    onConfirmReservation: async () => true,
  },
};

export const MentorOwnProfile: Story = {
  args: {
    isOwnMentorProfile: true,
    isUserDataLoading: false,
    isAuthenticated: true,
    slots: mockBookingSlots,
    monthLoaded: true,
    selectedSlot: null,
    setSelectedSlot: () => {},
    isSubmitting: false,
    selectedDate: '2026-08-05',
    onReservation: () => alert('預約設定點擊'),
    onConfirmReservation: async () => true,
  },
};

export const MenteeProfileView: Story = {
  args: {
    isOwnMentorProfile: false,
    isUserDataLoading: false,
    isAuthenticated: true,
    slots: mockBookingSlots,
    monthLoaded: true,
    selectedSlot: mockBookingSlots[0],
    setSelectedSlot: () => {},
    isSubmitting: false,
    selectedDate: '2026-08-05',
    onReservation: () => {},
    onConfirmReservation: async () => true,
  },
};
