import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { ReservationListSkeleton } from '@/app/reservation/skeleton';

import { mockReservations } from './__mocks__/reservations.mock';
import { ReservationList } from './ReservationList';

const meta: Meta<typeof ReservationList> = {
  title: '業務模組元件/預約管理(Reservation)/ReservationList',
  component: ReservationList,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-background-white mx-auto max-w-[800px] p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    myUserId: 'user-mentor-current',
  },
};

export default meta;
type Story = StoryObj<typeof ReservationList>;

// 1. Realistic Mixed List - Upcoming (Multiple reservations in different status badge countdown states)
export const UpcomingList: Story = {
  args: {
    items: [
      // Imminent (starts in 15 mins)
      mockReservations[4],
      // Live (currently active)
      mockReservations[5],
      // Soon (starts in 3 hours)
      mockReservations[3],
      // Far (starts in 3 days)
      mockReservations[2],
    ],
    variant: 'upcoming',
    sourceRole: 'mentor',
    myUserId: 'user-mentor-current',
  },
};

// 2. Pending List (Mentee's perspective, with Cancel Reservation dialog action)
export const PendingMenteeList: Story = {
  args: {
    items: [
      // Pending awaiting response, from mentee's perspective
      mockReservations[1],
    ],
    variant: 'pending-mentee',
    sourceRole: 'mentee',
    myUserId: 'user-mentee-current',
  },
};

// 3. Pending List (Mentor's perspective, with Accept & Reject Dialog actions)
export const PendingMentorList: Story = {
  args: {
    items: [
      // Pending awaiting response, from mentor's perspective
      mockReservations[0],
    ],
    variant: 'pending-mentor',
    sourceRole: 'mentor',
    myUserId: 'user-mentor-current',
  },
};

// 4. History List (Realistic mix of successfully ended and cancelled bookings)
export const HistoryList: Story = {
  args: {
    items: [
      // Successful end
      mockReservations[6],
      // Cancelled by mentor
      mockReservations[7],
      // Cancelled by mentee
      mockReservations[8],
    ],
    variant: 'history',
    sourceRole: 'mentor',
    myUserId: 'user-mentor-current',
  },
};

// 5. Empty State (Default Mentor Upcoming)
export const EmptyState: Story = {
  args: {
    items: [],
    variant: 'upcoming',
    sourceRole: 'mentor',
  },
};

export const EmptyUpcomingMentee: Story = {
  args: {
    items: [],
    variant: 'upcoming',
    sourceRole: 'mentee',
    myUserId: 'user-mentee-current',
  },
};

export const EmptyPendingMentee: Story = {
  args: {
    items: [],
    variant: 'pending-mentee',
    sourceRole: 'mentee',
    myUserId: 'user-mentee-current',
  },
};

export const EmptyHistoryMentee: Story = {
  args: {
    items: [],
    variant: 'history',
    sourceRole: 'mentee',
    myUserId: 'user-mentee-current',
  },
};

export const EmptyUpcomingMentor: Story = {
  args: {
    items: [],
    variant: 'upcoming',
    sourceRole: 'mentor',
    myUserId: 'user-mentor-current',
  },
};

export const EmptyPendingMentor: Story = {
  args: {
    items: [],
    variant: 'pending-mentor',
    sourceRole: 'mentor',
    myUserId: 'user-mentor-current',
  },
};

export const EmptyHistoryMentor: Story = {
  args: {
    items: [],
    variant: 'history',
    sourceRole: 'mentor',
    myUserId: 'user-mentor-current',
  },
};

// 6. Loading State (Renders the Skeleton loader)
export const LoadingState: Story = {
  render: () => <ReservationListSkeleton rows={3} />,
};

// 7. History Cancelled With Original Question & Cancel Reason (#860)
export const CancelledHistoryWithReason: Story = {
  args: {
    items: [mockReservations[8]],
    variant: 'history',
    sourceRole: 'mentee',
    myUserId: 'user-mentee-jolin',
  },
};

// 8. Mentee History Feedback States (#730: Needs Feedback, Public Rating, Unpublicized Rating, Not Happened)
export const MenteeHistoryFeedbackStates: Story = {
  args: {
    items: [
      {
        ...mockReservations[6],
        id: 'res-feedback-answer',
        feedback: {
          meetingHappened: null,
          rating: null,
          nextStep: 'ANSWER',
        },
      },
      {
        ...mockReservations[6],
        id: 'res-feedback-public',
        name: '陳大文 (David Chen)',
        feedback: {
          meetingHappened: true,
          rating: {
            rating: 10,
            content: '非常實用的職涯與系統設計建議，收穫良多！',
            createdAt: 1760000000,
            updatedAt: 1760000000,
            authorName: 'Jay',
            isPublic: true,
          },
          nextStep: null,
        },
      },
      {
        ...mockReservations[6],
        id: 'res-feedback-unpublicized',
        name: '林佳穎 (Emily Lin)',
        feedback: {
          meetingHappened: false,
          rating: {
            rating: 8,
            content: '謝謝分享。',
            createdAt: 1760000000,
            updatedAt: 1760000000,
            authorName: 'Jay',
            isPublic: false,
          },
          nextStep: null,
        },
      },
      {
        ...mockReservations[6],
        id: 'res-feedback-not-happened',
        name: '蘇元貞 (Julie Su)',
        feedback: {
          meetingHappened: false,
          rating: null,
          nextStep: null,
        },
      },
    ],
    variant: 'history',
    sourceRole: 'mentee',
    myUserId: 'user-mentee-jay',
  },
};

// 11. Deep-Link Highlighted & Auto-Expanded History Card (#733)
export const DeepLinkTargetHighlightedAndAutoExpanded: Story = {
  args: {
    items: [
      {
        ...mockReservations[6],
        id: 'res-deeplink-rated',
        name: '陳大文 (David Chen)',
        feedback: {
          meetingHappened: true,
          rating: {
            rating: 10,
            content: '非常實用的職涯與系統設計建議，收穫良多！',
            createdAt: 1760000000,
            updatedAt: 1760000000,
            authorName: 'Jay',
            isPublic: true,
          },
          nextStep: null,
        },
      },
      mockReservations[6],
    ],
    variant: 'history',
    sourceRole: 'mentee',
    myUserId: 'user-mentee-jay',
    highlightedReservationId: 'res-deeplink-rated',
    autoExpandedReservationId: 'res-deeplink-rated',
  },
};

// 12. Mentor History Confirm-Session & Public Feedback States (#735)
export const MentorHistoryFeedbackStates: Story = {
  args: {
    items: [
      {
        ...mockReservations[6],
        id: 'mentor-res-confirmed-rated',
        name: 'Zahra Mirzakhani',
        roleLine: 'Senior UX Designer · 5–10 年工作經驗',
        viewerRole: 'MENTOR',
        feedback: {
          meetingHappened: true,
          myMeetingHappened: true,
          rating: {
            rating: 10,
            content: '謝謝導師清楚拆解設計系統與跨職能溝通策略！',
            createdAt: 1761609600,
            updatedAt: 1761609600,
            authorName: 'Z***',
            isPublic: true,
          },
          nextStep: null,
        },
      },
      {
        ...mockReservations[6],
        id: 'mentor-res-needs-confirm',
        name: 'Emily Chen',
        roleLine: 'UI/UX 設計師 · 5–10 年工作經驗',
        viewerRole: 'MENTOR',
        feedback: {
          meetingHappened: null,
          rating: null,
          nextStep: 'ANSWER',
        },
      },
      {
        ...mockReservations[6],
        id: 'mentor-res-not-happened',
        name: 'Alex Wang',
        roleLine: '後端工程師 · 5–10 年工作經驗',
        viewerRole: 'MENTOR',
        feedback: {
          meetingHappened: false,
          myMeetingHappened: false,
          rating: null,
          nextStep: null,
        },
      },
      mockReservations[7],
    ],
    variant: 'history',
    sourceRole: 'mentor',
    myUserId: 'user-mentor-current',
  },
};
