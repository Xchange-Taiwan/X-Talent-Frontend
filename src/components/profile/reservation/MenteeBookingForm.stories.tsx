import type { Meta, StoryObj } from '@storybook/nextjs';

import { mockBookingSlots } from './__mocks__/reservationStories.mock';
import { MenteeBookingForm } from './MenteeBookingForm';

const meta: Meta<typeof MenteeBookingForm> = {
  title: 'Components/Profile/Reservation/MenteeBookingForm',
  component: MenteeBookingForm,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MenteeBookingForm>;

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
    slots: mockBookingSlots,
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
    slots: mockBookingSlots,
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
    slots: mockBookingSlots,
    monthLoaded: true,
    selectedSlot: mockBookingSlots[0],
    setSelectedSlot: () => {},
    isSubmitting: false,
    selectedDate: '2026-08-05',
    onConfirmReservation: async () => true,
    isAuthenticated: true,
  },
};

export const Submitting: Story = {
  args: {
    slots: mockBookingSlots,
    monthLoaded: true,
    selectedSlot: mockBookingSlots[0],
    setSelectedSlot: () => {},
    isSubmitting: true,
    selectedDate: '2026-08-05',
    onConfirmReservation: async () => true,
    isAuthenticated: true,
  },
};
