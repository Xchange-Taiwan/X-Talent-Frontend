import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import { mockReservations } from './__mocks__/reservations.mock';
import { ReservationDashboardView } from './ReservationDashboard';

const meta: Meta<typeof ReservationDashboardView> = {
  title: '業務模組元件/預約管理(Reservation)/ReservationDashboard',
  component: ReservationDashboardView,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-background-white p-4 md:p-8">
        <Story />
      </div>
    ),
  ],
  args: {
    role: 'mentor',
    myUserId: 'user-mentor-current',
    upcoming: [
      mockReservations[4], // Imminent
      mockReservations[5], // Live
      mockReservations[3], // Soon
      mockReservations[2], // Far
    ],
    pending: [
      mockReservations[0], // Pending mentor
    ],
    history: [
      mockReservations[6], // Successful ended
      mockReservations[7], // Cancelled by mentor
      mockReservations[8], // Cancelled by mentee
    ],
    isLoadingUpcoming: false,
    isLoadingPending: false,
    isLoadingHistory: false,
    isHistoryLoaded: true,
    nextTokens: { upcoming: 0, pending: 0, history: 0 },
    loadingMoreStates: { upcoming: false, pending: false, history: false },
    onLoadMoreUpcoming: () => console.log('Load more upcoming'),
    onLoadMorePending: () => console.log('Load more pending'),
    onLoadMoreHistory: () => console.log('Load more history'),
    onLoadHistory: () => console.log('Load history triggered'),
  },
};

export default meta;
type Story = StoryObj<typeof ReservationDashboardView>;

// 1. Mentor View ("擔任導師" dashboard, with action buttons to accept/reject pending bookings)
export const MentorView: Story = {
  args: {
    role: 'mentor',
    myUserId: 'user-mentor-current',
    upcoming: [
      mockReservations[4], // Sylvia - Imminent
      mockReservations[5], // Albert - Live
      mockReservations[3], // James - Soon
      mockReservations[2], // Grace - Far
    ],
    pending: [
      mockReservations[0], // Chloe - Pending Mentor
    ],
    history: [
      mockReservations[6], // Jay - Ended
      mockReservations[8], // Jolin - Cancelled by Mentee
    ],
  },
};

// 2. Mentee View ("預約導師" dashboard, with cancellation dialog actions)
export const MenteeView: Story = {
  args: {
    role: 'mentee',
    myUserId: 'user-mentee-current',
    upcoming: [
      mockReservations[5], // Albert - Live (current user is participant)
    ],
    pending: [
      mockReservations[1], // Harrison - Pending Mentee
    ],
    history: [
      mockReservations[7], // Arthur - Cancelled by Mentor
    ],
  },
};

// 3. Empty State (When all lists are empty and loaded)
export const EmptyState: Story = {
  args: {
    role: 'mentor',
    myUserId: 'user-mentor-current',
    upcoming: [],
    pending: [],
    history: [],
    isHistoryLoaded: true,
  },
};

// 4. Loading / Skeleton State (Renders skeletons for the initial tabs)
export const LoadingState: Story = {
  args: {
    role: 'mentor',
    myUserId: 'user-mentor-current',
    upcoming: [],
    pending: [],
    history: [],
    isLoadingUpcoming: true,
    isLoadingPending: true,
    isLoadingHistory: false,
    isHistoryLoaded: false,
  },
};
