import type { Meta, StoryObj } from '@storybook/nextjs';

import { mockBookingSlots } from './__mocks__/reservationStories.mock';
import { MenteeBookingForm } from './MenteeBookingForm';

const meta: Meta<typeof MenteeBookingForm> = {
  title: '業務模組元件/個人檔案(Profile)/Reservation/MenteeBookingForm',
  component: MenteeBookingForm,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '導師個人頁可預約時段選擇與問題填寫表單，點擊時段（`profile_booking_slot_select`）、未登入引導（`reservation_signin_prompt_click`）與送出預約（`profile_booking_submit_click`）皆攜帶 `mentor_id` 以串聯轉換漏斗（不記錄填寫之問題內容）。',
      },
    },
  },
  args: {
    mentorId: 7482008160728084,
  },
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

export const UnauthenticatedSignInPrompt: Story = {
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

export const NoAvailableSlots: Story = {
  args: {
    slots: [],
    monthLoaded: true,
    selectedSlot: null,
    setSelectedSlot: () => {},
    isSubmitting: false,
    selectedDate: '2026-08-05',
    onConfirmReservation: async () => true,
    isAuthenticated: true,
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
