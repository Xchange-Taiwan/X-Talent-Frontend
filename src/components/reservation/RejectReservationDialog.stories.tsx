import type { Meta, StoryObj } from '@storybook/nextjs';

import RejectReservationDialog from './RejectReservationDialog';
import type { Reservation } from './types';

const meta: Meta<typeof RejectReservationDialog> = {
  title: 'Components/Reservation/RejectReservationDialog',
  component: RejectReservationDialog,
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: 'boolean',
      description: 'Whether the dialog trigger and action buttons are disabled',
    },
  },
};

export default meta;
type Story = StoryObj<typeof RejectReservationDialog>;

const mockReservation: Reservation = {
  id: 'res-415',
  name: '王小明 (Alvin Wang)',
  roleLine: 'Google 台灣 Senior Frontend Engineer / 前端架構專家',
  date: '2026年8月5日 (星期三)',
  time: '20:00 – 21:00',
  messages: [
    {
      content:
        '嗨！我想向您諮詢關於大型 React 專案在 Next.js App Router 架構底下的元件拆分，以及效能瓶頸（RSC vs Client Component）的實戰優化建議。另外也想了解在跨國外商的升遷機制與面試準備重點，謝謝導師！',
      role: 'MENTEE',
    },
  ],
  menteeMessage: {
    content:
      '嗨！我想向您諮詢關於大型 React 專案在 Next.js App Router 架構底下的元件拆分，以及效能瓶頸（RSC vs Client Component）的實戰優化建議。另外也想了解在跨國外商的升遷機制與面試準備重點，謝謝導師！',
    role: 'MENTEE',
  },
  scheduleId: 101,
  dtstart: Math.floor(Date.now() / 1000) + 3 * 24 * 3600,
  dtend: Math.floor(Date.now() / 1000) + 3 * 24 * 3600 + 3600,
  senderUserId: 'user-mentee-111',
  participantUserId: 'user-mentor-222',
};

// 1. Default State (Closed, clickable)
export const Default: Story = {
  args: {
    reservation: mockReservation,
    disabled: false,
    onReject: async (payload) => {
      console.log('onReject called with payload:', payload);
      alert(`已拒絕預約！原因: ${payload.reason}`);
    },
  },
};

// 2. Loading / Submitting State: Simulated by returning a pending promise.
// Clicking "拒絕" inside the open dialog (after typing a reason) will lock it in loading spinner state.
export const LoadingState: Story = {
  args: {
    reservation: mockReservation,
    disabled: false,
    onReject: () => {
      return new Promise((resolve) => {
        // Keeps the dialog in isSubmitting state for 10 seconds
        setTimeout(resolve, 10000);
      });
    },
  },
};

// 3. Disabled State: Trigger button is disabled
export const Disabled: Story = {
  args: {
    reservation: mockReservation,
    disabled: true,
  },
};
