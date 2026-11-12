import type { Meta, StoryObj } from '@storybook/nextjs';

import MeetingFeedbackDialog from './MeetingFeedbackDialog';
import { mockReservation } from './mocks';

const meta: Meta<typeof MeetingFeedbackDialog> = {
  title: '業務模組元件/預約管理(Reservation)/MeetingFeedbackDialog',
  component: MeetingFeedbackDialog,
  tags: ['autodocs'],
  args: {
    reservation: {
      ...mockReservation,
      name: 'Emily Chen',
      roleLine: 'UI/UX 設計師 · 5–10 年工作經驗',
      date: '2026/10/20',
      time: '19:00–19:30',
      feedback: {
        meetingHappened: null,
        rating: null,
        nextStep: 'ANSWER',
      },
    },
    onSubmitFeedback: async () => {},
  },
};

export default meta;
type Story = StoryObj<typeof MeetingFeedbackDialog>;

export const ClosedTrigger: Story = {
  args: {
    defaultOpen: false,
  },
};

export const StepAttendanceOpen: Story = {
  args: {
    defaultOpen: true,
    initialStep: 'attendance',
  },
};

export const StepRatingStarsOpen: Story = {
  args: {
    defaultOpen: true,
    initialStep: 'rating',
  },
};

export const StepRatingSliderOpen: Story = StepRatingStarsOpen;

export const StepNotHappenedOpen: Story = {
  args: {
    defaultOpen: true,
    initialStep: 'not-happened',
  },
};
