import type { Meta, StoryObj } from '@storybook/nextjs';
import React from 'react';

import type {
  ReservationTabSlice,
  UseReservationDashboardReturn,
} from '@/hooks/user/reservation/useReservationData';
import type { ReservationTabParam } from '@/lib/reservation/reservationRoutes';
import type { Reservation } from '@/types/reservation';

import { mockReservations } from './__mocks__/reservations.mock';
import { ReservationDashboard } from './ReservationDashboard';

const noopAsync = async () => {};

function buildTabSlice(
  items: Reservation[],
  overrides: Partial<ReservationTabSlice> = {}
): ReservationTabSlice {
  return {
    items,
    badgeCount: items.length,
    showBadge: true,
    isInitialLoading: false,
    isFetching: false,
    isLoadingMore: false,
    isLoaded: true,
    hasMore: false,
    loadMore: noopAsync,
    ...overrides,
  };
}

function buildStoryDashboard(options: {
  activeTab?: ReservationTabParam;
  myUserId: string;
  pending?: Reservation[];
  upcoming?: Reservation[];
  history?: Reservation[];
  pendingOverrides?: Partial<ReservationTabSlice>;
  upcomingOverrides?: Partial<ReservationTabSlice>;
  historyOverrides?: Partial<ReservationTabSlice>;
}): UseReservationDashboardReturn {
  return {
    activeTab: options.activeTab ?? 'pending',
    myUserId: options.myUserId,
    loadHistory: noopAsync,
    tabs: {
      pending: buildTabSlice(options.pending ?? [], options.pendingOverrides),
      upcoming: buildTabSlice(
        options.upcoming ?? [],
        options.upcomingOverrides
      ),
      history: buildTabSlice(options.history ?? [], options.historyOverrides),
    },
  };
}

const meta: Meta<typeof ReservationDashboard> = {
  title: '業務模組元件/預約管理(Reservation)/ReservationDashboard',
  component: ReservationDashboard,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-background-white min-h-screen p-4 md:p-8">
        <Story />
      </div>
    ),
  ],
  args: {
    userRole: 'mentor',
    initialDashboard: buildStoryDashboard({
      myUserId: 'user-mentor-current',
      pending: [mockReservations[0]],
      upcoming: [
        mockReservations[4],
        mockReservations[5],
        mockReservations[3],
        mockReservations[2],
      ],
      history: [mockReservations[6], mockReservations[7], mockReservations[8]],
    }),
  },
};

export default meta;
type Story = StoryObj<typeof ReservationDashboard>;

// 1. Mentor View ("擔任導師" dashboard, with action buttons to accept/reject pending bookings)
export const MentorView: Story = {
  args: {
    userRole: 'mentor',
    initialDashboard: buildStoryDashboard({
      myUserId: 'user-mentor-current',
      pending: [mockReservations[0]],
      upcoming: [
        mockReservations[4],
        mockReservations[5],
        mockReservations[3],
        mockReservations[2],
      ],
      history: [mockReservations[6], mockReservations[8]],
    }),
  },
};

// 2. Mentee View ("預約導師" dashboard, with cancellation dialog actions)
export const MenteeView: Story = {
  args: {
    userRole: 'mentee',
    initialDashboard: buildStoryDashboard({
      myUserId: 'user-mentee-current',
      pending: [mockReservations[1]],
      upcoming: [mockReservations[5]],
      history: [mockReservations[7]],
    }),
  },
};

// 3. Empty State (When all lists are empty and loaded)
export const EmptyState: Story = {
  args: {
    userRole: 'mentor',
    initialDashboard: buildStoryDashboard({
      myUserId: 'user-mentor-current',
    }),
  },
};

// 4. Loading / Skeleton State (Renders skeletons for the initial tabs)
export const LoadingState: Story = {
  args: {
    userRole: 'mentor',
    initialDashboard: buildStoryDashboard({
      myUserId: 'user-mentor-current',
      pendingOverrides: {
        isInitialLoading: true,
        isFetching: true,
        isLoaded: false,
      },
      upcomingOverrides: {
        isInitialLoading: true,
        isFetching: true,
        isLoaded: false,
      },
      historyOverrides: { showBadge: false, isLoaded: false },
    }),
  },
};

// 5. History Tab Loading on Render 1 While Preserving Existing Badge Counts (#860 / #939)
export const HistoryLoadingWithPreservedCounts: Story = {
  args: {
    userRole: 'mentee',
    initialDashboard: buildStoryDashboard({
      activeTab: 'history',
      myUserId: 'user-mentee-current',
      pending: [mockReservations[1]],
      upcoming: [mockReservations[5]],
      history: [],
      historyOverrides: {
        isInitialLoading: true,
        isFetching: true,
        isLoaded: false,
        showBadge: false,
      },
    }),
  },
};

// 6. Mentee History Loaded With Pending & Completed Feedback Cards (#733)
export const MenteeHistoryWithFeedbackItems: Story = {
  args: {
    userRole: 'mentee',
    initialDashboard: buildStoryDashboard({
      activeTab: 'history',
      myUserId: 'user-mentee-current',
      history: [
        {
          ...mockReservations[6],
          id: 'res-733-pending',
          feedback: {
            meetingHappened: null,
            rating: null,
            nextStep: 'ANSWER',
          },
        },
      ],
    }),
  },
};
