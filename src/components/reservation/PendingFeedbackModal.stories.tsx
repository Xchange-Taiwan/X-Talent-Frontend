import type { Meta, StoryObj } from '@storybook/nextjs';

import { mockReservation } from './mocks';
import { PendingFeedbackModal } from './PendingFeedbackModal';

const queueFixture = [
  {
    ...mockReservation,
    id: 'pending-1',
    name: 'Emily Chen',
    roleLine: 'UI/UX 設計師 · 5–10 年工作經驗',
    date: '2026/10/12',
    time: '19:00–19:30',
    dtstart: 1760266800,
    dtend: 1760268600,
    viewerRole: 'MENTEE' as const,
    feedback: {
      meetingHappened: null,
      rating: null,
      nextStep: 'ANSWER' as const,
    },
  },
  {
    ...mockReservation,
    id: 'pending-2',
    name: 'Alex Wang',
    roleLine: '後端工程師 · 5–10 年工作經驗',
    date: '2026/10/18',
    time: '20:00–20:30',
    dtstart: 1760788800,
    dtend: 1760790600,
    viewerRole: 'MENTEE' as const,
    feedback: {
      meetingHappened: null,
      rating: null,
      nextStep: 'ANSWER' as const,
    },
  },
  {
    ...mockReservation,
    id: 'pending-3',
    name: 'Zahra Mirzakhani',
    roleLine: 'Senior UX Designer · 5–10 年工作經驗',
    date: '2026/10/25',
    time: '21:00–21:30',
    dtstart: 1761397200,
    dtend: 1761399000,
    viewerRole: 'MENTEE' as const,
    feedback: {
      meetingHappened: null,
      rating: null,
      nextStep: 'ANSWER' as const,
    },
  },
];

const meta: Meta<typeof PendingFeedbackModal> = {
  title: '業務模組元件/預約管理(Reservation)/PendingFeedbackModal',
  component: PendingFeedbackModal,
  tags: ['autodocs'],
  args: {
    queueItems: queueFixture,
    onSubmitFeedback: async () => {},
    onSkipReservation: () => {},
    onClose: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof PendingFeedbackModal>;

export const EmptyNoPopup: Story = {
  args: {
    queueItems: null,
  },
};

export const MenteeSingleSession: Story = {
  args: {
    queueItems: [queueFixture[0]],
  },
};

export const MenteeThreeSessionQueue: Story = {
  args: {
    queueItems: queueFixture,
  },
};

export const MentorThreeSessionQueue: Story = {
  args: {
    viewerRole: 'mentor',
    queueItems: queueFixture.map((item) => ({
      ...item,
      viewerRole: 'MENTOR' as const,
    })),
  },
};
