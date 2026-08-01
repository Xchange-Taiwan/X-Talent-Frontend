import type { Meta, StoryObj } from '@storybook/nextjs';

import CancelReservationDialog from './CancelReservationDialog';
import { mockReservation } from './mocks';

const meta: Meta<typeof CancelReservationDialog> = {
  title: '業務模組元件/預約管理(Reservation)/CancelReservationDialog',
  component: CancelReservationDialog,
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: 'boolean',
      description: '對話框的觸發器與操作按鈕是否已被禁用',
    },
  },
};

export default meta;
type Story = StoryObj<typeof CancelReservationDialog>;

// 1. Default State (Closed, clickable)
export const Default: Story = {
  args: {
    reservation: mockReservation,
    disabled: false,
    onConfirmCancel: async (payload) => {
      console.log('onConfirmCancel called with payload:', payload);
      alert(`已取消預約！原因: ${payload.reason}`);
    },
  },
};

// 2. Loading / Submitting State: Simulated by returning a pending promise.
// Clicking "取消預約" inside the open dialog (after typing a reason) will lock it in loading spinner state.
export const LoadingState: Story = {
  args: {
    reservation: mockReservation,
    disabled: false,
    onConfirmCancel: () => {
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
