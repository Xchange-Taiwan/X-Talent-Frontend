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
          '導師個人頁可預約時段選擇與問題填寫表單，點擊時段（`profile_booking_slot_select`）、未登入攔截曝光與點擊（`auth_gate_triggered` + `reservation_signin_prompt_click`）與送出預約（`profile_booking_submit_click`）皆攜帶 `mentor_id` 以串聯轉換漏斗（不記錄填寫之問題內容，且提問輸入區具備 Clarity 個資遮罩）。',
      },
    },
  },
  args: {
    mentorId: 7482008160728084,
    myUserId: '7482008160728087',
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
    selectedDate: '2026-08-05',
    isAuthenticated: true,
  },
};

export const Unauthenticated: Story = {
  args: {
    slots: mockBookingSlots,
    monthLoaded: true,
    selectedSlot: null,
    setSelectedSlot: () => {},
    selectedDate: '2026-08-05',
    isAuthenticated: false,
  },
};

export const UnauthenticatedSignInPrompt: Story = {
  args: {
    slots: mockBookingSlots,
    monthLoaded: true,
    selectedSlot: null,
    setSelectedSlot: () => {},
    selectedDate: '2026-08-05',
    isAuthenticated: false,
  },
};

export const NoAvailableSlots: Story = {
  args: {
    slots: [],
    monthLoaded: true,
    selectedSlot: null,
    setSelectedSlot: () => {},
    selectedDate: '2026-08-05',
    isAuthenticated: true,
  },
};

export const NotSelected: Story = {
  args: {
    slots: mockBookingSlots,
    monthLoaded: true,
    selectedSlot: null,
    setSelectedSlot: () => {},
    selectedDate: '2026-08-05',
    isAuthenticated: true,
  },
};

export const SlotSelected: Story = {
  args: {
    slots: mockBookingSlots,
    monthLoaded: true,
    selectedSlot: mockBookingSlots[0],
    setSelectedSlot: () => {},
    selectedDate: '2026-08-05',
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
    isAuthenticated: true,
  },
};
