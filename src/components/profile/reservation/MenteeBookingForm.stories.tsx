import type { Meta, StoryObj } from '@storybook/nextjs';

import { MenteeBookingForm } from './MenteeBookingForm';

const meta: Meta<typeof MenteeBookingForm> = {
  title: 'Components/Profile/Reservation/MenteeBookingForm',
  component: MenteeBookingForm,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MenteeBookingForm>;

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
    scheduleId: 301,
    isBooked: false,
  },
  {
    start: relativeDate(2), // 2 hours in future
    end: relativeDate(2, 30),
    scheduleId: 302,
    isBooked: true,
  },
];

export const Loading: Story = {
  args: {
    slots: [],
    monthLoaded: false,
    selectedSlot: null,
    setSelectedSlot: () => {},
    isSubmitting: false,
    selectedDate: '2026-08-05',
    onConfirmReservation: async () => true,
    isAuthenticated: true,
  },
};

export const Unauthenticated: Story = {
  args: {
    slots: mockSlots,
    monthLoaded: true,
    selectedSlot: null,
    setSelectedSlot: () => {},
    isSubmitting: false,
    selectedDate: '2026-08-05',
    onConfirmReservation: async () => true,
    isAuthenticated: false,
  },
};

export const NotSelected: Story = {
  args: {
    slots: mockSlots,
    monthLoaded: true,
    selectedSlot: null,
    setSelectedSlot: () => {},
    isSubmitting: false,
    selectedDate: '2026-08-05',
    onConfirmReservation: async () => true,
    isAuthenticated: true,
  },
};

export const SlotSelected: Story = {
  args: {
    slots: mockSlots,
    monthLoaded: true,
    selectedSlot: mockSlots[0],
    setSelectedSlot: () => {},
    isSubmitting: false,
    selectedDate: '2026-08-05',
    onConfirmReservation: async () => true,
    isAuthenticated: true,
  },
};

export const Submitting: Story = {
  args: {
    slots: mockSlots,
    monthLoaded: true,
    selectedSlot: mockSlots[0],
    setSelectedSlot: () => {},
    isSubmitting: true,
    selectedDate: '2026-08-05',
    onConfirmReservation: async () => true,
    isAuthenticated: true,
  },
};
