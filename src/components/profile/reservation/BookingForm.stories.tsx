import type { Meta, StoryObj } from '@storybook/nextjs';

import { BookingForm } from './BookingForm';

const meta: Meta<typeof BookingForm> = {
  title: 'Components/Profile/Reservation/BookingForm',
  component: BookingForm,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof BookingForm>;

const now = new Date();

// Helper to create dates relative to now
const relativeDate = (hoursOffset: number, minutesOffset: number = 0) => {
  const d = new Date(now);
  d.setHours(d.getHours() + hoursOffset, minutesOffset, 0, 0);
  return d;
};

const mockSlots = [
  {
    start: relativeDate(1), // 1 hour in future
    end: relativeDate(1, 30),
    scheduleId: 401,
    isBooked: false,
  },
  {
    start: relativeDate(2), // 2 hours in future
    end: relativeDate(2, 30),
    scheduleId: 402,
    isBooked: true,
  },
];

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
    slots: mockSlots,
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
    slots: mockSlots,
    monthLoaded: true,
    selectedSlot: mockSlots[0],
    setSelectedSlot: () => {},
    isSubmitting: false,
    selectedDate: '2026-08-05',
    onReservation: () => {},
    onConfirmReservation: async () => true,
  },
};
