import type { Meta, StoryObj } from '@storybook/nextjs';

import { mockReservation } from './mocks';
import RejectReservationDialog from './RejectReservationDialog';

const meta: Meta<typeof RejectReservationDialog> = {
  title: '業務模組元件/預約管理(Reservation)/RejectReservationDialog',
  component: RejectReservationDialog,
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: 'boolean',
      description: '對話框的觸發器與操作按鈕是否已被禁用',
    },
  },
};

export default meta;
type Story = StoryObj<typeof RejectReservationDialog>;

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
