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

export const EditTriggerClosed: Story = {
  args: {
    mode: 'edit',
    defaultOpen: false,
    reservation: {
      ...mockReservation,
      name: '陳大文',
      roleLine: '資深產品經理 · 5–10 年工作經驗',
      date: '2026/08/06',
      time: '19:00–20:00',
      feedback: {
        meetingHappened: true,
        rating: {
          rating: 8,
          content: '準備得非常充分，直接給了我下一步該做什麼。',
          createdAt: 1760000000,
          updatedAt: 1760000000,
          authorName: '王＊明',
          isPublic: true,
        },
        nextStep: null,
      },
    },
    onUpdateFeedback: async () => {},
  },
};

export const EditModePrefilledOpen: Story = {
  args: {
    mode: 'edit',
    defaultOpen: true,
    reservation: {
      ...mockReservation,
      name: '陳大文',
      roleLine: '資深產品經理 · 5–10 年工作經驗',
      date: '2026/08/06',
      time: '19:00–20:00',
      feedback: {
        meetingHappened: true,
        rating: {
          rating: 8,
          content: '準備得非常充分，直接給了我下一步該做什麼。',
          createdAt: 1760000000,
          updatedAt: 1760000000,
          authorName: '王＊明',
          isPublic: true,
        },
        nextStep: null,
      },
    },
    onUpdateFeedback: async () => {},
  },
};
