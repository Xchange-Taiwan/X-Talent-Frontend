import type { Meta, StoryObj } from '@storybook/nextjs';

import AcceptReservationDialog from './AcceptReservationDialog';
import { mockReservation } from './mocks';

const meta: Meta<typeof AcceptReservationDialog> = {
  title: 'Components/Reservation/AcceptReservationDialog',
  component: AcceptReservationDialog,
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: 'boolean',
      description: 'Whether the dialog trigger and action buttons are disabled',
    },
  },
};

export default meta;
type Story = StoryObj<typeof AcceptReservationDialog>;

// 1. Default State (Closed, clickable)
export const Default: Story = {
  args: {
    reservation: mockReservation,
    disabled: false,
    onAccept: async (payload) => {
      console.log('onAccept called with payload:', payload);
      alert(`已接受預約！回覆訊息: ${payload.message || '(無)'}`);
    },
  },
};

// 2. Loading / Submitting State: Simulated by returning a pending promise.
// Clicking "接受" will trigger and lock the dialog in the loading spinner state.
export const LoadingState: Story = {
  args: {
    reservation: mockReservation,
    disabled: false,
    onAccept: () => {
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

// 4. No Message State: When the mentee hasn't left a message
export const NoMenteeMessage: Story = {
  args: {
    reservation: {
      ...mockReservation,
      messages: [],
      menteeMessage: undefined,
    },
    disabled: false,
    onAccept: async (payload) => {
      console.log('onAccept called with payload:', payload);
      alert(`已接受預約！回覆訊息: ${payload.message || '(無)'}`);
    },
  },
};
