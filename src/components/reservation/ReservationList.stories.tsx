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
